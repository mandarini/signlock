import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef
} from "@angular/core";
import * as tf from "@tensorflow/tfjs";
import { Webcam } from "../webcam";
import { ControllerDataset } from "../controller-dataset";
import { Model } from "@tensorflow/tfjs";

@Component({
  selector: "app-controls",
  templateUrl: "./controls.component.html",
  styleUrls: ["./controls.component.scss"]
})
export class ControlsComponent implements AfterViewInit, OnInit {
  CONTROLS: Array<string> = ["up", "down", "left", "right"];
  examples: Object = {
    "up":0,
    "down":0,
    "left": 0,
    "right": 0
  };
  CONTROL_CODES: Array<number> = [38, 40, 37, 39];
  NUM_CLASSES: number = 4;
  webcam: Webcam;
  controllerDataset: ControllerDataset;
  truncatedMobileNet: any;
  model: any;
  addExampleHandler: any;
  thumbDisplayed: Object;
  isPredicting: boolean = false;
  predictingVisible: boolean = true;

  learningRates: Array<Object> = [
    { num: 0.00001, name: "0.00001" },
    { num: 0.0001, name: "0.0001" },
    { num: 0.001, name: "0.001" },
    { num: 0.003, name: "0.003" }
  ];

  batchSizes: Array<Object> = [
    { num: 0.05, name: "0.05" },
    { num: 0.1, name: "0.1" },
    { num: 0.4, name: "0.4" },
    { num: 1, name: "1" }
  ];
  epochsOptions: Array<Object> = [
    { num: 10, name: "10" },
    { num: 20, name: "20" },
    { num: 40, name: "40" }
  ];
  hiddenUnits: Array<Object> = [
    { num: 10, name: "10" },
    { num: 100, name: "100" },
    { num: 200, name: "200" }
  ];

  learningRateSel: number = 0.0001;
  batchSizeSel: number = 0.4;
  epochSel: number = 20;
  denseSel: number = 100;

  @ViewChild("controller") controller: ElementRef;
  @ViewChild("trainStatus") trainStatusEl: ElementRef;
  @ViewChild("status") statusEl: ElementRef;
  @ViewChild("webcam") webcamEl: ElementRef;
  @ViewChild("leftThumb") leftThumb: ElementRef;
  @ViewChild("rightThumb") rightThumb: ElementRef;
  @ViewChild("upThumb") upThumb: ElementRef;
  @ViewChild("downThumb") downThumb: ElementRef;

  BUTTONS: Array<ElementRef> = [
    this.upThumb,
    this.downThumb,
    this.leftThumb,
    this.rightThumb
  ];

  constructor() {
    this.controllerDataset = new ControllerDataset(this.NUM_CLASSES);
  }

  ngOnInit() {
    this.init();
  }

  ngAfterViewInit() {
    console.log("hey");
    this.webcam = new Webcam(this.webcamEl.nativeElement);
    this.webcam
      .setup()
      .then(() => {
        console.log("trying");
      })
      .catch(() => {
        document.getElementById("no-webcam").style.display = "block";
      });
    this.setExampleHandler(label => {
      tf.tidy(() => {
        const img = this.webcam.capture();
        this.controllerDataset.addExample(
          this.truncatedMobileNet.predict(img),
          label
        );

        // Draw the preview thumbnail.
        this.drawThumb(img, label);
      });
    });
  }

  async init() {
    this.truncatedMobileNet = await this.loadTruncatedMobileNet();

    // Warm up the model. This uploads weights to the GPU and compiles the WebGL
    // programs so the first time we collect data from the webcam it will be
    // quick.
    tf.tidy(() => this.truncatedMobileNet.predict(this.webcam.capture()));

    this.controller.nativeElement.style.display = "";
    this.statusEl.nativeElement.style.display = "none";
  }

  async loadTruncatedMobileNet() {
    const mobilenet = await tf.loadModel(
      "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json"
    );

    // Return a model that outputs an internal activation.
    const layer = mobilenet.getLayer("conv_pw_13_relu");
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
  }

  setExampleHandler(handler) {
    this.addExampleHandler = handler;
  }

  drawThumb(img, label) {
    if (this.thumbDisplayed[label] == null) {
      const thumbCanvas = this.BUTTONS[label];
      this.draw(img, thumbCanvas);
    }
  }

  draw(image, canvas) {
    const [width, height] = [224, 224];
    const ctx = canvas.getContext("2d");
    const imageData = new ImageData(width, height);
    const data = image.dataSync();
    for (let i = 0; i < height * width; ++i) {
      const j = i * 4;
      imageData.data[j + 0] = (data[i * 3 + 0] + 1) * 127;
      imageData.data[j + 1] = (data[i * 3 + 1] + 1) * 127;
      imageData.data[j + 2] = (data[i * 3 + 2] + 1) * 127;
      imageData.data[j + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  async train() {
    if (this.controllerDataset.xs == null) {
      throw new Error("Add some examples before training!");
    }

    // Creates a 2-layer fully connected model. By creating a separate model,
    // rather than adding layers to the mobilenet model, we "freeze" the weights
    // of the mobilenet model, and only train weights from the new model.
    this.model = tf.sequential({
      layers: [
        // Flattens the input to a vector so we can use it in a dense layer. While
        // technically a layer, this only performs a reshape (and has no training
        // parameters).
        tf.layers.flatten({
          inputShape: this.truncatedMobileNet.outputs[0].shape.slice(1)
        }),
        // Layer 1.
        tf.layers.dense({
          units: +this.denseSel,
          activation: "relu",
          kernelInitializer: "varianceScaling",
          useBias: true
        }),
        // Layer 2. The number of units of the last layer should correspond
        // to the number of classes we want to predict.
        tf.layers.dense({
          units: this.NUM_CLASSES,
          kernelInitializer: "varianceScaling",
          useBias: false,
          activation: "softmax"
        })
      ]
    });

    // Creates the optimizers which drives training of the model.
    const optimizer = tf.train.adam(this.learningRateSel);
    // We use categoricalCrossentropy which is the loss function we use for
    // categorical classification which measures the error between our predicted
    // probability distribution over classes (probability that an input is of each
    // class), versus the label (100% probability in the true class)>
    this.model.compile({
      optimizer: optimizer,
      loss: "categoricalCrossentropy"
    });

    // We parameterize batch size as a fraction of the entire dataset because the
    // number of examples that are collected depends on how many examples the user
    // collects. This allows us to have a flexible batch size.
    const batchSize = Math.floor(
      this.controllerDataset.xs.shape[0] * this.batchSizeSel
    );
    if (!(batchSize > 0)) {
      throw new Error(
        `Batch size is 0 or NaN. Please choose a non-zero fraction.`
      );
    }

    // Train the model! Model.fit() will shuffle xs & ys so we don't have to.
    this.model.fit(this.controllerDataset.xs, this.controllerDataset.ys, {
      batchSize,
      epochs: +this.epochSel,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          this.trainStatus("Loss: " + logs.loss.toFixed(5));
        }
      }
    });
  }

  trainStatus(status: string) {
    this.trainStatusEl.nativeElement.innerText = status;
  }
  async predict() {
    this.predictingVisible = true;
    while (this.isPredicting) {
      const predictedClass = tf.tidy(() => {
        // Capture the frame from the webcam.
        const img = this.webcam.capture();

        // Make a prediction through mobilenet, getting the internal activation of
        // the mobilenet model, i.e., "embeddings" of the input images.
        const embeddings = this.truncatedMobileNet.predict(img);

        // Make a prediction through our newly-trained model using the embeddings
        // from mobilenet as input.
        const predictions = this.model.predict(embeddings);

        // Returns the index with the maximum probability. This number corresponds
        // to the class the model thinks is the most probable given the input.
        return predictions.as1D().argMax();
      });

      const classId = (await predictedClass.data())[0];
      predictedClass.dispose();

      document.body.setAttribute("data-active", this.CONTROLS[classId]);
      await tf.nextFrame();
    }
    this.predictingVisible = false;
  }

  async trainBtn() {
    this.trainStatus("Training...");
    await tf.nextFrame();
    await tf.nextFrame();
    this.isPredicting = false;
    this.train();
  }

  predictBtn() {
    this.isPredicting = true;
    this.predict();
  }

  async handler(label) {
    this.addExampleHandler(label);
    this.examples[label]++;
    await tf.nextFrame();
    document.body.removeAttribute("data-active");
  }
}

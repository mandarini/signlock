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
export class ControlsComponent implements AfterViewInit {
  CONTROLS: Array<string> = ["up", "down", "left", "right"];
  CONTROL_CODES: Array<number> = [38, 40, 37, 39];
  NUM_CLASSES: number = 4;
  webcam: Webcam;
  controllerDataset: ControllerDataset;
  truncatedMobileNet: any;
  model: Model;
  addExampleHandler: any;
  thumbDisplayed = Object;

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
  @ViewChild("trainStatus") trainStatus: ElementRef;
  @ViewChild("learningRate") learningRate: ElementRef;
  @ViewChild("batchSizeFraction") batchSizeFraction: ElementRef;
  @ViewChild("epochs") epochs: ElementRef;
  @ViewChild("denseUnits") denseUnits: ElementRef;
  @ViewChild("status") status: ElementRef;
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

  ngAfterViewInit() {
    this.webcam = new Webcam(this.webcamEl.nativeElement);
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

  train() {
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
          units: this.getDenseUnits(),
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
  }
}

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
import {
  AngularFirestore,
  AngularFirestoreCollection
} from "@angular/fire/firestore";
import { Observable } from "rxjs";
import { AngularFireAuth } from "@angular/fire/auth";
import { AngularFireStorage } from "@angular/fire/storage";

@Component({
  selector: "app-controls",
  templateUrl: "./controls.component.html",
  styleUrls: ["./controls.component.scss"]
})
export class ControlsComponent implements AfterViewInit, OnInit {
  CONTROLS: Array<string> = ["first", "second", "third", "control"];
  CONTROL_CODES: Array<number> = [38, 40, 37, 39];
  NUM_CLASSES: number = 4;
  webcam: Webcam;
  controllerDataset: ControllerDataset;
  truncatedMobileNet: any;
  model: any;
  addExampleHandler: any;
  thumbDisplayed: Object = {};
  isPredicting: boolean = false;
  predictingVisible: boolean = true;

  currentMove: string;

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
  @ViewChild("status") statusEl: ElementRef;
  @ViewChild("webcam") webcamEl: ElementRef;
  @ViewChild("thirdThumb") thirdThumb: ElementRef;
  @ViewChild("controlThumb") controlThumb: ElementRef;
  @ViewChild("firstThumb") firstThumb: ElementRef;
  @ViewChild("secondThumb") secondThumb: ElementRef;
  @ViewChild("moodFile") moodFile: ElementRef;

  BUTTONS: Array<ElementRef>;
  private itemsCollection: AngularFirestoreCollection<any>;
  items: Observable<any[]>;

  fileName1: string;
  fileName2: string;

  jsonFile: File;
  weightsFile: File;

  donejson: boolean = false;
  doneweights: boolean = false;

  trainStatus: string = "TRAIN MODEL";
  doneTraining: boolean = false;
  downloaded: boolean = false;

  constructor(
    private afs: AngularFirestore,
    public afAuth: AngularFireAuth,
    private storage: AngularFireStorage
  ) {
    this.itemsCollection = afs.collection<any>("items");
    this.items = this.itemsCollection.valueChanges();
    this.controllerDataset = new ControllerDataset(this.NUM_CLASSES);
  }

  uploadFile(event, name) {
    console.log(event, "file", event.target.files[0]);
    console.log("uploading", name);
    const file = event.target.files[0];
    const filePath = name;
    const ref = this.storage.ref(filePath);
    const task = ref.put(file);
    console.log(task);
    task
      .then(res => {
        console.log(res);
      })
      .catch(err => {
        console.error(err);
      });
  }

  ngOnInit() {
    this.init();
  }

  ngAfterViewInit() {
    console.log("hey");
    this.BUTTONS = [
      this.firstThumb,
      this.secondThumb,
      this.thirdThumb,
      this.controlThumb
    ];
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
    const layer = mobilenet.getLayer("conv_pw_13_relu");
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
  }

  setExampleHandler(handler) {
    this.addExampleHandler = handler;
  }

  drawThumb(img, label) {
    if (this.thumbDisplayed[label] == null) {
      console.log(this.BUTTONS);
      const thumbCanvas = this.BUTTONS[label].nativeElement;
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

    const optimizer = tf.train.adam(this.learningRateSel);
    this.model.compile({
      optimizer: optimizer,
      loss: "categoricalCrossentropy"
    });
    const batchSize = Math.floor(
      this.controllerDataset.xs.shape[0] * this.batchSizeSel
    );
    if (!(batchSize > 0)) {
      throw new Error(
        `Batch size is 0 or NaN. Please choose a non-zero fraction.`
      );
    }
    this.model.fit(this.controllerDataset.xs, this.controllerDataset.ys, {
      batchSize,
      epochs: +this.epochSel,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          this.trainStatus = "Loss: " + logs.loss.toFixed(5);
          this.doneTraining = true;
        }
      }
    });
  }

  async predict() {
    this.predictingVisible = true;
    console.log("predicting");
    while (this.isPredicting) {
      const predictedClass = tf.tidy(() => {
        const img = this.webcam.capture();
        const embeddings = this.truncatedMobileNet.predict(img);
        const predictions = this.model.predict(embeddings);
        return predictions.as1D().argMax();
      });

      const classId = (await predictedClass.data())[0];
      predictedClass.dispose();
      console.log("moving ", this.CONTROLS[classId]);

      this.currentMove = this.CONTROLS[classId];

      document.body.setAttribute("data-active", this.CONTROLS[classId]);
      await tf.nextFrame();
    }
    this.predictingVisible = false;
  }

  async trainBtn() {
    this.trainStatus = "Training...";
    await tf.nextFrame();
    await tf.nextFrame();
    this.isPredicting = false;
    this.train();
  }

  predictBtn() {
    this.currentMove = null;
    this.isPredicting = !this.isPredicting;
    this.predict();
  }

  async handler(label) {
    this.addExampleHandler(label);
    await tf.nextFrame();
    document.body.removeAttribute("data-active");
  }

  saveModel() {
    this.model.save("downloads://my-model-1").then(res => {
      console.log(res);
      this.downloaded = true;
    });
  }

  loadModel() {
    tf.loadModel(tf.io.browserFiles([this.jsonFile, this.weightsFile])).then(
      res => {
        this.model = res;
      }
    );
  }

  loadJson() {
    const ref = this.storage.ref("trainedjson");
    this.afAuth.auth.currentUser.getIdToken(true).then(idToken => {
      ref.getDownloadURL().subscribe(item => {
        console.log(item);
        fetch(item, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        })
          .then(response => {
            console.log(response);
            return response.blob();
          })
          .then(blob => {
            this.jsonFile = new File([blob], "jsonFile");
            console.log(this.fileName1);
            this.donejson = true;
          })
          .catch(err => {
            console.error(err);
          });
      });
    });
  }

  loadWeights() {
    const ref = this.storage.ref("trainedweights");
    this.afAuth.auth.currentUser.getIdToken(true).then(idToken => {
      ref.getDownloadURL().subscribe(item => {
        console.log(item);
        fetch(item, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        })
          .then(response => {
            console.log(response);
            return response.blob();
          })
          .then(blob => {
            this.weightsFile = new File([blob], "my-model-1.weights.bin");
            console.log(this.weightsFile);
            this.doneweights = true;
          })
          .catch(err => {
            console.error(err);
          });
      });
    });
  }
}

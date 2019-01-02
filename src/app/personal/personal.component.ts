import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef
} from "@angular/core";
import * as tf from "@tensorflow/tfjs";
import { Webcam } from "../webcam";
import {
  AngularFirestore,
  AngularFirestoreCollection
} from "@angular/fire/firestore";
import { Observable } from "rxjs";
import { AngularFireAuth } from "@angular/fire/auth";
import { AngularFireStorage } from "@angular/fire/storage";

@Component({
  selector: "app-personal",
  templateUrl: "./personal.component.html",
  styleUrls: ["./personal.component.scss"]
})
export class PersonalComponent implements AfterViewInit, OnInit {
  CONTROLS: Array<string> = ["first", "second", "third", "none"];
  @ViewChild("webcam") webcamEl: ElementRef;
  @ViewChild("captImg") captImg: ElementRef;
  @ViewChild("first") first: ElementRef;
  @ViewChild("second") second: ElementRef;
  @ViewChild("third") third: ElementRef;
  captImgEl: any;
  loading: boolean = true;

  SIGNS: Array<ElementRef>;
  webcam: Webcam;
  model: any;

  private itemsCollection: AngularFirestoreCollection<any>;
  items: Observable<any[]>;

  fileName1: string;
  fileName2: string;

  jsonFile: File;
  weightsFile: File;

  donejson: boolean = false;
  doneweights: boolean = false;
  haswebcam: boolean = true;

  truncatedMobileNet: any;

  constructor(
    private afs: AngularFirestore,
    public afAuth: AngularFireAuth,
    private storage: AngularFireStorage
  ) {
    this.itemsCollection = afs.collection<any>("items");
    this.items = this.itemsCollection.valueChanges();
  }

  ngOnInit() {
    this.init();
  }

  ngAfterViewInit() {
    this.SIGNS = [this.first, this.second, this.third];
    console.log("hey", this.webcamEl);
    this.webcam = new Webcam(this.webcamEl.nativeElement);
    this.webcam
      .setup()
      .then(() => {
        console.log("trying");
      })
      .catch(() => {
        this.haswebcam = false;
      });
    // const img = this.webcam.capture();
  }

  draw(image, id) {
    const [width, height] = [224, 224];
    const ctx = this.SIGNS[id].nativeElement.getContext("2d");
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

  predictBtn(id: number) {
    this.predict(id);
  }

  async predict(id: number) {
    // this.predictingVisible = true;
    console.log("predicting");
    // while (this.isPredicting) {
    const predictedClass = tf.tidy(() => {
      const img = this.webcam.capture();
      this.draw(img, id);
      const embeddings = this.truncatedMobileNet.predict(img);
      const predictions = this.model.predict(embeddings);
      return predictions.as1D().argMax();
    });

    const classId = (await predictedClass.data())[0];
    predictedClass.dispose();
    console.log("captured ", this.CONTROLS[classId]);
    await tf.nextFrame();
  }

  async init() {
    this.truncatedMobileNet = await this.loadTruncatedMobileNet();
    tf.tidy(() => this.truncatedMobileNet.predict(this.webcam.capture()));
    this.loading = false;
  }

  async loadTruncatedMobileNet() {
    const mobilenet = await tf.loadModel(
      "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json"
    );
    const layer = mobilenet.getLayer("conv_pw_13_relu");
    return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
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

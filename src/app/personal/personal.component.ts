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
  CONTROLS: Array<string> = ["up", "down", "left", "right"];
  @ViewChild("webcam") webcamEl: ElementRef;
  loading: boolean = true;
  model: any;
  examples: Object = {
    up: 0,
    down: 0,
    left: 0,
    right: 0
  };
  CONTROL_CODES: Array<number> = [38, 40, 37, 39];
  NUM_CLASSES: number = 4;
  webcam: Webcam;

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
    console.log("hey");
    this.webcam = new Webcam(this.webcamEl.nativeElement);
    this.webcam
      .setup()
      .then(() => {
        console.log("trying");
      })
      .catch(() => {
        this.haswebcam = false;
      });

    const img = this.webcam.capture();
    this.drawThumb(img, label);
  }

  predictBtn() {
    this.isPredicting = true;
    this.predict();
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

      document.body.setAttribute("data-active", this.CONTROLS[classId]);
      await tf.nextFrame();
    }
    this.predictingVisible = false;
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

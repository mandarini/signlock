import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef
} from "@angular/core";
import * as tf from "@tensorflow/tfjs";
import { Webcam } from "../webcam";
import { Observable } from "rxjs";
import { AngularFireAuth } from "@angular/fire/auth";
import { AngularFireStorage } from "@angular/fire/storage";
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument
} from "@angular/fire/firestore";

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
  errormsg: Array<string> = ["3 tries left", "3 tries left", "3 tries left"];
  tries: Array<number> = [0, 0, 0];
  found: Array<boolean> = [false, false, false];

  SIGNS: Array<ElementRef>;
  webcam: Webcam;
  model: any;

  fileName1: string;
  fileName2: string;

  jsonFile: File;
  weightsFile: File;

  nowLoading: boolean = false;
  haswebcam: boolean = true;

  showSpace: boolean = false;

  truncatedMobileNet: any;

  private loggedUser: AngularFirestoreDocument<any>;
  loggedUserData: Observable<any>;

  constructor(
    private afs: AngularFirestore,
    public afAuth: AngularFireAuth,
    private storage: AngularFireStorage
  ) {
    this.loggedUser = afs
      .collection("users")
      .doc(this.afAuth.auth.currentUser.uid)
      .collection("authStatus")
      .doc("loggedIn");
    this.loggedUserData = this.loggedUser.valueChanges();
  }

  ngOnInit() {
    this.init();
    this.loggedUser.set({ status: false });
  }

  ngAfterViewInit() {
    this.SIGNS = [this.first, this.second, this.third];
    console.log("hey", this.webcamEl, this.SIGNS);
    this.webcam = new Webcam(this.webcamEl.nativeElement);
    this.webcam
      .setup()
      .then(() => {
        console.log("trying");
      })
      .catch(() => {
        this.haswebcam = false;
      });
  }

  leaveSpace() {
    this.showSpace = false;
    this.errormsg = ["3 tries left", "3 tries left", "3 tries left"];
    this.tries = [0, 0, 0];
    this.found = [false, false, false];
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
    this.tries[id]++;
    console.log(this.tries);
    if (!this.found[id]) {
      if (this.tries[id] < 3) {
        this.predict(id);
        this.errormsg[id] = 3 - this.tries[id] + " tries left!";
      } else {
        this.errormsg[id] = "Sorry, no more tries!";
      }
    } else {
      this.errormsg[id] = "Already found this!";
    }
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
    console.log("captured ", this.CONTROLS[classId], classId);
    if (classId === id) {
      this.errormsg[id] = "Correct!";
      this.found[id] = true;
    }

    if (this.found[0] && this.found[1] && this.found[2]) {
      console.log("found everything");
      this.loggedUser.set({ status: true });
    }
    await tf.nextFrame();
  }

  async init() {
    this.truncatedMobileNet = await this.loadTruncatedMobileNet();
    tf.tidy(() => this.truncatedMobileNet.predict(this.webcam.capture()));
    this.loadJson();
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
        this.nowLoading = false;
        this.loading = false;
      }
    );
  }

  loadJson() {
    this.nowLoading = true;
    const ref = this.storage.ref(
      `${this.afAuth.auth.currentUser.uid}/model_json`
    );
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
            this.jsonFile = new File([blob], "sign-model.json");
            this.loadWeights();
          })
          .catch(err => {
            console.error(err);
          });
      });
    });
  }

  loadWeights() {
    const ref = this.storage.ref(
      `${this.afAuth.auth.currentUser.uid}/model_weights`
    );
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
            this.weightsFile = new File([blob], "sign-model.weights.bin");
            this.loadModel();
          })
          .catch(err => {
            console.error(err);
          });
      });
    });
  }
}

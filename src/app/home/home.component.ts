import { Component, OnInit } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/auth";
import { Observable } from "rxjs";
import {
  AngularFirestore,
  AngularFirestoreDocument
} from "@angular/fire/firestore";
@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"]
})
export class HomeComponent implements OnInit {
  loginScreen: boolean = false;
  signstep: Observable<boolean>;
  user: any;
  private modelJsonDoc: AngularFirestoreDocument<any>;
  modelJsonData: Observable<any>;
  private modelWeightsDoc: AngularFirestoreDocument<any>;
  modelWeightsData: Observable<any>;
  statusJ: boolean;
  statusW: boolean;

  constructor(private afs: AngularFirestore, public afAuth: AngularFireAuth) {
    this.user = this.afAuth.auth.currentUser;
    this.modelJsonDoc = afs
      .collection("users")
      .doc(this.afAuth.auth.currentUser.uid)
      .collection("model")
      .doc("json");
    this.modelJsonData = this.modelJsonDoc.valueChanges();
    this.modelWeightsDoc = afs
      .collection("users")
      .doc(this.afAuth.auth.currentUser.uid)
      .collection("model")
      .doc("weights");
    this.modelWeightsData = this.modelWeightsDoc.valueChanges();
  }

  ngOnInit() {
    this.modelJsonData.subscribe(res => {
      this.statusJ = res.status;
    });
    this.modelWeightsData.subscribe(res => {
      this.statusW = res.status;
    });
  }

  logout() {
    this.afAuth.auth.signOut();
  }
}

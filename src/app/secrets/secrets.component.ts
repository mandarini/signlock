import { Component, OnInit, Input } from "@angular/core";
import {
  AngularFirestore,
  AngularFirestoreDocument,
  AngularFirestoreCollection
} from "@angular/fire/firestore";
import { AngularFireAuth } from "@angular/fire/auth";
import { Observable } from "rxjs";

@Component({
  selector: "app-secrets",
  templateUrl: "./secrets.component.html",
  styleUrls: ["./secrets.component.scss"]
})
export class SecretsComponent implements OnInit {
  private secretsCollection: AngularFirestoreCollection<any>;
  secrets: Observable<any[]>;
  @Input() newSecret: string;

  constructor(private afs: AngularFirestore, public afAuth: AngularFireAuth) {
    this.secretsCollection = afs
      .collection("users")
      .doc(this.afAuth.auth.currentUser.uid)
      .collection("secrets");
    this.secrets = this.secretsCollection.valueChanges();
  }

  addItem(secret: string) {
    let item = {
      secret: secret
    };
    this.secretsCollection.add(item);
  }

  ngOnInit() {
    this.secrets.subscribe(res => {
      console.log(res);
    });
  }
}

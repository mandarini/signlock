import { Component, OnInit } from "@angular/core";
import {
  AngularFirestore,
  AngularFirestoreDocument
} from "@angular/fire/firestore";
import { AngularFireAuth } from "@angular/fire/auth";

@Component({
  selector: "app-secrets",
  templateUrl: "./secrets.component.html",
  styleUrls: ["./secrets.component.scss"]
})
export class SecretsComponent implements OnInit {
  private itemsCollection: AngularFirestoreCollection<Item>;
  items: Observable<Item[]>;

  constructor(private afs: AngularFirestore, public afAuth: AngularFireAuth) {
    this.itemsCollection = afs
      .collection("users")
      .doc(this.afAuth.auth.currentUser.uid)
      .collection("secrets");
    this.items = this.itemsCollection.valueChanges();
  }

  addItem(secret: string) {
    let item = {
      secret: secret
    };
    this.itemsCollection.add(item);
  }

  ngOnInit() {
    this.items.subscribe(res => {
      console.log(res);
    });
  }
}

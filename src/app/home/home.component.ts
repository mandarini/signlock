import { Component, OnInit } from "@angular/core";
import { AngularFireAuth } from '@angular/fire/auth';

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"]
})
export class HomeComponent implements OnInit {
  loginScreen: boolean = false;
  signstep: boolean = false;
  user: any;

  constructor(public afAuth: AngularFireAuth) {
    this.user = this.afAuth.auth.currentUser;
  }

  ngOnInit() {}
}

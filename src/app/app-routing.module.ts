import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { CreateComponent } from "./create/create.component";
import { HomeComponent } from "./home/home.component";
import { PersonalComponent } from "./personal/personal.component";
import { HelpComponent } from "./help/help.component";

const routes: Routes = [
  { path: "*", redirectTo: "home" },
  { path: "", redirectTo: "home", pathMatch: "full" },
  {
    path: "home",
    component: HomeComponent
    // canActivate: [AppAuthGuard]
  },
  {
    path: "create",
    component: CreateComponent
    // canActivate: [AppAuthGuard]
  },
  {
    path: "personal",
    component: PersonalComponent
    // canActivate: [AppAuthGuard]
  },
  {
    path: "help",
    component: HelpComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}

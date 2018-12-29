import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CreateComponent } from './create/create.component';
import { HomeComponent } from './home/home.component';

const routes: Routes = [
  { path: "*", redirectTo: "home" },
  {
    path: "home",
    component: HomeComponent,
    // canActivate: [AppAuthGuard]
  },
  {
    path: "create",
    component: CreateComponent,
    // canActivate: [AppAuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { StartupsPageComponent } from './components/startups/startups-page/startups-page.component';
import { BmcComponent } from './components/bmc/bmc.component';
import { BmcPublicComponent } from './components/bmc/bmc-public/bmc-public.component';
import { AuthGuard } from './services/auth.guard'; 
const routes: Routes = [
  { path: '', component: LoginComponent },           // default route -> login
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'startups', component: StartupsPageComponent, canActivate: [AuthGuard] },
  { path: 'bmc/join', component: BmcPublicComponent }, // Handle the /bmc/join?token=xxx links
  { path: 'bmc/:id',  component: BmcComponent,          canActivate: [AuthGuard] },
  { path: 'bmc',      component: BmcComponent,          canActivate: [AuthGuard] },

  { path: 'bmc/public/:token', component: BmcPublicComponent },
  { path: '**',       redirectTo: 'login' }

  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
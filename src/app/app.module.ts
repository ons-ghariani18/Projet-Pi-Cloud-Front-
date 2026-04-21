import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopnavComponent } from './components/topnav/topnav.component';
import { ToastComponent } from './components/toast/toast.component';
import { StartupsPageComponent } from './components/startups/startups-page/startups-page.component';
import { StatCardsComponent } from './components/startups/stat-cards/stat-cards.component';
import { StartupTableComponent } from './components/startups/startup-table/startup-table.component';
import { StartupCardsComponent } from './components/startups/startup-cards/startup-cards.component';
import { StatusModalComponent } from './components/startups/status-modal/status-modal.component';
import { AddStartupModalComponent } from './components/startups/add-startup-modal/add-startup-modal.component';
import { EditStartupModalComponent } from './components/startups/edit-startup-modal/edit-startup-modal.component';
import { BmcComponent } from './components/bmc/bmc.component';
import { BmcPublicComponent } from './components/bmc/bmc-public/bmc-public.component';
import { MembrePerformanceComponent } from './components/startups/membre-performance/membre-performance.component';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { NamingInterceptor } from './interceptors/naming.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    SidebarComponent,
    TopnavComponent,
    ToastComponent,
    StartupsPageComponent,
    StatCardsComponent,
    StartupTableComponent,
    StartupCardsComponent,
    StatusModalComponent,
    AddStartupModalComponent,
    EditStartupModalComponent,
    BmcComponent,
    BmcPublicComponent,
    MembrePerformanceComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    DragDropModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: NamingInterceptor, multi: true }
  ],

  bootstrap: [AppComponent]
})
export class AppModule { }
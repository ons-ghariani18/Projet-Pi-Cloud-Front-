import { NgModule, LOCALE_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { registerLocaleData, CommonModule } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';

registerLocaleData(localeFr);

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

/* ─── VERSION HEAD ────────────────────────────────────────── */
import { DashboardOrgComponent } from './dashboard-org/dashboard-org.component';
import { DashboardUserComponent } from './dashboard-user/dashboard-user.component';
import { DashboardAdminComponent as DashboardAdminHeadComponent } from './dashboard-admin/dashboard-admin.component';
import { LogoutComponent } from './logout/logout.component';
import { CheckinComponent } from './checkin/checkin.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';

/* ─── VERSION AZIZ ───────────────────────────────────────── */
import { ForumListComponent } from './forum-list/forum-list.component';
import { ForumPostDetailComponent } from './forum-post-detail/forum-post-detail.component';
import { UserSearchComponent } from './user-search/user-search.component';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProfileModule } from './profile/profile.module';

/* ─── VERSION ONS ────────────────────────────────────────── */
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
import { VersioningComponent } from './components/bmc/versioning/versioning.component';
import { MembrePerformanceComponent } from './components/startups/membre-performance/membre-performance.component';
import { PitchTrainerComponent } from './pitch-trainer/pitch-trainer.component';
import { FinancialSimulationComponent } from './components/startups/financial-simulation/financial-simulation.component';
import { ExchangeRateModalComponent } from './components/exchange-rate-modal/exchange-rate-modal.component';

/* ─── VERSION LATIFA ─────────────────────────────────────── */
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { CatalogueComponent } from './formation/catalogue/catalogue.component';
import { LeconViewerComponent } from './formation/lecon-viewer/lecon-viewer.component';
import { DashboardEntrepreneurComponent } from './formation/dashboard-entrepreneur/dashboard-entrepreneur.component';
import { MentorDashboardComponent } from './formation/mentor-dashboard/mentor-dashboard.component';
import { CertificatComponent } from './formation/certificat/certificat.component';
import { SafePipe } from './shared/safe.pipe';
import { NotificationBellComponent } from './shared/notification-bell/notification-bell.component';
import { CreationTestComponent } from './formation/creation-test/creation-test.component';
import { CalendrierTestsComponent } from './formation/calendrier-tests/calendrier-tests.component';
import { PassageTestComponent } from './formation/passage-test/passage-test.component';
import { CorrectionTestComponent } from './formation/correction-test/correction-test.component';
import { PassageTestSuccessComponent } from './formation/passage-test-success/passage-test-success.component';
import { LiveRoomsLobbyComponent } from './shared/live-rooms-lobby/live-rooms-lobby.component';
import { LiveRoomComponent } from './shared/live-room/live-room.component';
import { LeaderboardComponent } from './formation/leaderboard/leaderboard.component';
import { MentorStatsComponent } from './formation/mentor-stats/mentor-stats.component';
import { PaymentModalComponent } from './formation/payment-modal/payment-modal.component';
import { HomeComponent } from './home/home.component';
import { SigninComponent } from './signin/signin.component';
import { SignupComponent } from './signup/signup.component';
import { AdminDashboardComponent as AdminDashboardStandaloneComponent } from './admin-dashboard/admin-dashboard.component';

/* ─── VERSION LOUSSAIEF ──────────────────────────────────── */
import { OpportunitesPublicComponent } from './features/opportunite/pages/opportunites-public/opportunites-public.component';
import { OpportuniteDetailComponent } from './features/opportunite/pages/opportunite-detail/opportunite-detail.component';
import { OpportunitesAdminComponent } from './features/opportunite/pages/opportunites-admin/opportunites-admin.component';
import { CandidatePublicComponent } from './features/candidature/pages/candidature-public/candidature-public.component';
import { MesCandidatesComponent } from './features/candidature/pages/mes-candidatures/mes-candidatures.component';
import { CandidaturesAdminComponent } from './features/candidature/pages/candidatures-admin/candidatures-admin.component';
import { AdminDashboardComponent as AdminDashboardLoussaiefComponent } from './features/admin/pages/admin-dashboard/admin-dashboard.component';

/* ─── INTERCEPTORS ───────────────────────────────────────── */
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { NamingInterceptor } from './interceptors/naming.interceptor';
import { HomeAdminComponent } from './home-admin/home-admin.component';
import { SwotService } from './services/swot.service';

@NgModule({
  declarations: [
    AppComponent,

    // ── HEAD ──
    DashboardOrgComponent,
    DashboardUserComponent,
    DashboardAdminHeadComponent,
    LogoutComponent,
    CheckinComponent,
    UnauthorizedComponent,

    // ── Aziz ──
    ForumListComponent,
    ForumPostDetailComponent,
    UserSearchComponent,

    // ── Ons ──
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
    VersioningComponent,
    MembrePerformanceComponent,
    FinancialSimulationComponent,
    ExchangeRateModalComponent,

    // ── Latifa ──
    AdminDashboardComponent,
    CatalogueComponent,
    LeconViewerComponent,
    DashboardEntrepreneurComponent,
    MentorDashboardComponent,
    CertificatComponent,
    SafePipe,
    NotificationBellComponent,
    CreationTestComponent,
    CalendrierTestsComponent,
    PassageTestComponent,
    CorrectionTestComponent,
    PassageTestSuccessComponent,
    LiveRoomsLobbyComponent,
    LiveRoomComponent,
    LeaderboardComponent,
    MentorStatsComponent,
    PaymentModalComponent,
    HomeComponent,
      

    // ── Loussaief ──
    OpportunitesPublicComponent,
    OpportuniteDetailComponent,
    OpportunitesAdminComponent,
    CandidatePublicComponent,
    MesCandidatesComponent,
    CandidaturesAdminComponent,
    AdminDashboardLoussaiefComponent,
  ],

  imports: [
     HomeAdminComponent,
    AdminDashboardStandaloneComponent,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    CommonModule,
    DragDropModule,
    DashboardModule,
    ProfileModule,
    PitchTrainerComponent,
    SigninComponent,
    SignupComponent,
     

  ],

  providers: [
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: NamingInterceptor, multi: true },
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    SwotService
  ],

  schemas: [CUSTOM_ELEMENTS_SCHEMA],

  bootstrap: [AppComponent],
})
export class AppModule {}

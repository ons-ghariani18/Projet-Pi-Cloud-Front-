import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/* ─── Auth & Users (HEAD) ────────────────────────────────── */
import { SigninComponent } from './signin/signin.component';
import { SignupComponent } from './signup/signup.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { LogoutComponent } from './logout/logout.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';

/* ─── Core user pages (HEAD) ─────────────────────────────── */
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProfileComponent } from './profile/profile.component';
import { UserSearchComponent } from './user-search/user-search.component';

/* ─── Role-based dashboards (HEAD) ──────────────────────── */
import { DashboardOrgComponent } from './dashboard-org/dashboard-org.component';
import { DashboardUserComponent } from './dashboard-user/dashboard-user.component';
import { DashboardAdminComponent } from './dashboard-admin/dashboard-admin.component';

/* ─── Forum (HEAD) ───────────────────────────────────────── */
import { ForumListComponent } from './forum-list/forum-list.component';
import { ForumPostDetailComponent } from './forum-post-detail/forum-post-detail.component';

/* ─── Startups & BMC (HEAD) ──────────────────────────────── */
import { StartupsPageComponent } from './components/startups/startups-page/startups-page.component';
import { BmcComponent } from './components/bmc/bmc.component';
import { BmcPublicComponent } from './components/bmc/bmc-public/bmc-public.component';

/* ─── Pitch & Checkin (HEAD) ─────────────────────────────── */
import { CheckinComponent } from './checkin/checkin.component';
import { PitchTrainerComponent } from './pitch-trainer/pitch-trainer.component';

/* ─── Home (feature/latifa) ──────────────────────────────── */
import { HomeComponent } from './home/home.component';

/* ─── Guard ──────────────────────────────────────────────── */
import { AuthGuard } from './auth.guard';

/* ─── Admin (Latifa - Course Moderation) ─────────────────── */
import { AdminDashboardComponent as AdminModerationComponent } from './admin/admin-dashboard/admin-dashboard.component';

/* ─── Admin (Social - News/Users/Stats) ───────────────────── */
import { AdminDashboardComponent as AdminSocialComponent } from './admin-dashboard/admin-dashboard.component';

/* ─── Formation (Latifa) ─────────────────────────────────── */
import { CatalogueComponent } from './formation/catalogue/catalogue.component';
import { LeconViewerComponent } from './formation/lecon-viewer/lecon-viewer.component';
import { DashboardEntrepreneurComponent } from './formation/dashboard-entrepreneur/dashboard-entrepreneur.component';
import { MentorDashboardComponent } from './formation/mentor-dashboard/mentor-dashboard.component';
import { CertificatComponent } from './formation/certificat/certificat.component';
import { CreationTestComponent } from './formation/creation-test/creation-test.component';
import { CalendrierTestsComponent } from './formation/calendrier-tests/calendrier-tests.component';
import { PassageTestComponent } from './formation/passage-test/passage-test.component';
import { CorrectionTestComponent } from './formation/correction-test/correction-test.component';
import { PassageTestSuccessComponent } from './formation/passage-test-success/passage-test-success.component';
import { LeaderboardComponent } from './formation/leaderboard/leaderboard.component';

/* ─── IdeaLab (Latifa) ───────────────────────────────────── */
import { LiveRoomsLobbyComponent } from './shared/live-rooms-lobby/live-rooms-lobby.component';
import { LiveRoomComponent } from './shared/live-room/live-room.component';

/* ─── Opportunités (loussaief) ───────────────────────────── */
import { OpportunitesPublicComponent } from './features/opportunite/pages/opportunites-public/opportunites-public.component';
import { OpportuniteDetailComponent } from './features/opportunite/pages/opportunite-detail/opportunite-detail.component';
import { OpportunitesAdminComponent } from './features/opportunite/pages/opportunites-admin/opportunites-admin.component';
import { CandidatePublicComponent } from './features/candidature/pages/candidature-public/candidature-public.component';
import { MesCandidatesComponent } from './features/candidature/pages/mes-candidatures/mes-candidatures.component';
import { CandidaturesAdminComponent } from './features/candidature/pages/candidatures-admin/candidatures-admin.component';
import { AdminDashboardComponent as AdminOpportunitesDashboardComponent } from './features/admin/pages/admin-dashboard/admin-dashboard.component';
import { HomeAdminComponent } from './home-admin/home-admin.component';

const routes: Routes = [
  // ───────── HOME ─────────
  { path: '', component: HomeComponent },

  // ───────── AUTH ─────────
  { path: 'signin', component: SigninComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'logout', component: LogoutComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },

  // ───────── MAIN DASHBOARD ─────────
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },

  // ───────── PROFILE / SEARCH ─────────
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'search', component: UserSearchComponent, canActivate: [AuthGuard] },

  // ───────── FORUM ─────────
  { path: 'forum', component: ForumListComponent, canActivate: [AuthGuard] },
  { path: 'forum/posts/:id', component: ForumPostDetailComponent, canActivate: [AuthGuard] },

  // ───────── ROLE-BASED DASHBOARDS ─────────
  { path: 'dashadmin', component: DashboardAdminComponent, canActivate: [AuthGuard], data: { roles: ['ROLE_ADMIN'] } },
  { path: 'dashorg', component: DashboardOrgComponent, canActivate: [AuthGuard], data: { roles: ['ROLE_ORGANISATEUR'] } },
  { path: 'dashuser', component: DashboardUserComponent, canActivate: [AuthGuard], data: { roles: ['ROLE_USER', 'ROLE_ENTREPRENEUR', 'ROLE_EXPERT'] } },

  // ───────── STARTUPS & BMC ─────────
  { path: 'startups', component: StartupsPageComponent, canActivate: [AuthGuard] },
  { path: 'bmc/join', component: BmcPublicComponent },
  { path: 'bmc/public/:token', component: BmcPublicComponent },
  { path: 'bmc/:id', component: BmcComponent, canActivate: [AuthGuard] },
  { path: 'bmc', component: BmcComponent, canActivate: [AuthGuard] },

  // ───────── PITCH & CHECKIN ─────────
  { path: 'pitch', component: PitchTrainerComponent, canActivate: [AuthGuard] },
  { path: 'checkin/event/:id', component: CheckinComponent },
  { path: 'checkin/hackathon/:id', component: CheckinComponent },

  // ───────── ADMIN ─────────
  { path: 'admin-dashboard', component: AdminSocialComponent, canActivate: [AuthGuard], data: { roles: ['ROLE_ADMIN'] } },
  { path: 'admin', component: AdminModerationComponent, canActivate: [AuthGuard] },
  { path: 'admin-panel', component: AdminModerationComponent, canActivate: [AuthGuard] },
  { path: 'admin/dashboard', component: AdminOpportunitesDashboardComponent },
  { path: 'admin/opportunites', component: OpportunitesAdminComponent },
  { path: 'admin/candidatures', component: CandidaturesAdminComponent },
  { path: 'admin/candidatures-admin', component: CandidaturesAdminComponent },
  { path: 'admin/Opp', redirectTo: 'admin/opportunites' },
  { path: 'admin/Condidature', redirectTo: 'admin/candidatures' },

  // ───────── FORMATION (LATIFA) ─────────
  { path: 'formations', component: CatalogueComponent, canActivate: [AuthGuard] },
  { path: 'formations/:formationId/lecons/:inscriptionId', component: LeconViewerComponent, canActivate: [AuthGuard] },
  { path: 'mes-formations', component: DashboardEntrepreneurComponent, canActivate: [AuthGuard] },
  { path: 'mentor', component: MentorDashboardComponent, canActivate: [AuthGuard] },
  { path: 'certificat/:token', component: CertificatComponent },
  { path: 'creation-test', component: CreationTestComponent, canActivate: [AuthGuard] },
  { path: 'calendrier-tests', component: CalendrierTestsComponent, canActivate: [AuthGuard] },
  { path: 'passage-test/:testId', component: PassageTestComponent, canActivate: [AuthGuard] },
  { path: 'entrepreneur/passage-test/:testId', component: PassageTestComponent, canActivate: [AuthGuard] },
  { path: 'passage-test-success', component: PassageTestSuccessComponent, canActivate: [AuthGuard] },
  { path: 'entrepreneur/passage-test-success', component: PassageTestSuccessComponent, canActivate: [AuthGuard] },
  { path: 'correction-test/:testId', component: CorrectionTestComponent, canActivate: [AuthGuard] },
  { path: 'classement', component: LeaderboardComponent, canActivate: [AuthGuard] },

  // ───────── IDEALAB (LATIFA) ─────────
  { path: 'idealab', component: LiveRoomsLobbyComponent, canActivate: [AuthGuard] },
  { path: 'live-room/:roomId', component: LiveRoomComponent, canActivate: [AuthGuard] },

  // ───────── OPPORTUNITÉS (LOUSSAIEF) ─────────
  { path: 'opportunite/:id', component: OpportuniteDetailComponent },
  { path: 'client/opportunites', component: OpportunitesPublicComponent },
  { path: 'client/candidatures', component: CandidatePublicComponent },
  { path: 'candidature-public', component: CandidatePublicComponent },
  { path: 'mes-candidatures', component: MesCandidatesComponent },
  { path: 'client/Condidature', redirectTo: 'candidature-public' },
  { path: 'client/candidature', redirectTo: 'candidature-public' },
{ path: 'homeadmin', component: HomeAdminComponent, canActivate: [AuthGuard], data: { roles: ['ROLE_ADMIN'] } },
  // ───────── FALLBACK ─────────
  { path: '**', redirectTo: 'signin' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}

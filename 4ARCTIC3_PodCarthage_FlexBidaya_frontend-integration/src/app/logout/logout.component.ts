import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class LogoutComponent implements OnInit {

  constructor(private userService: UserService, private router: Router) { }

  ngOnInit(): void { }

  logout() {
    console.log('Logout button clicked');
    this.userService.logout().subscribe(() => {
      // Supprimer le jeton du localStorage lors de la déconnexion
      localStorage.removeItem('token');
      console.log('Token removed from localStorage');

      // Rediriger vers la page de connexion
      this.router.navigate(['/signin']);
      console.log('Redirected to /signin');
    }, error => {
      console.log('Erreur lors de la déconnexion :', error);
    });
  }
}
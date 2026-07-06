import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  counted = false;

  constructor() {}

  ngOnInit(): void {
    window.addEventListener('scroll', this.animateStats.bind(this));
    setTimeout(() => this.animateStats(), 100);
  }

  animateStats() {
    if (this.counted) return;
    const statsSection = document.querySelector('#stats');
    if (!statsSection) return;
    
    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      this.counted = true;
      const counters = document.querySelectorAll('.stat-number');
      const speed = 180;
      
      counters.forEach((counter: any) => {
        const target = parseInt(counter.getAttribute('data-target'));
        let current = 0;
        const increment = target / speed;
        
        const update = () => {
          current += increment;
          if (current < target) {
            counter.innerText = Math.floor(current);
            requestAnimationFrame(update);
          } else {
            counter.innerText = target;
          }
        };
        update();
      });
    }
  }
}

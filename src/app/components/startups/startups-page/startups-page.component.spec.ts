import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartupsPageComponent } from './startups-page.component';

describe('StartupsPageComponent', () => {
  let component: StartupsPageComponent;
  let fixture: ComponentFixture<StartupsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StartupsPageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartupsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

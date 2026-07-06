import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PitchTrainerComponent } from './pitch-trainer.component';

describe('PitchTrainerComponent', () => {
  let component: PitchTrainerComponent;
  let fixture: ComponentFixture<PitchTrainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PitchTrainerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PitchTrainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

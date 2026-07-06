import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddStartupModalComponent } from './add-startup-modal.component';

describe('AddStartupModalComponent', () => {
  let component: AddStartupModalComponent;
  let fixture: ComponentFixture<AddStartupModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddStartupModalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddStartupModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

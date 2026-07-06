import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileComponent } from './profile.component';
import { EditProfileModule } from './edit-profile/edit-profile.module';

@NgModule({
  declarations: [
    ProfileComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    EditProfileModule
  ],
  exports: [
    ProfileComponent
  ]
})
export class ProfileModule { }

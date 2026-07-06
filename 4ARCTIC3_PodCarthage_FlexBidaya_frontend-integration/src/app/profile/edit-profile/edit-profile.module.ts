import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditProfileComponent } from './edit-profile.component';

@NgModule({
  declarations: [
    EditProfileComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    EditProfileComponent
  ]
})
export class EditProfileModule { }

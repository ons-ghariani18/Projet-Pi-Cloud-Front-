import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchPopupComponent } from './search-popup.component';

@NgModule({
  declarations: [
    SearchPopupComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    SearchPopupComponent
  ]
})
export class SearchPopupModule { }

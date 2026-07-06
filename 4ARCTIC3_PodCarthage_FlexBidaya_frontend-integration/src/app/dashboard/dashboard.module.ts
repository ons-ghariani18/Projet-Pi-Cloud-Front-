import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { DashboardComponent } from './dashboard.component';
import { FilterByParentPipe } from '../pipes/filter-by-parent.pipe';
import { SearchPopupModule } from '../components/search-popup/search-popup.module';

@NgModule({
  declarations: [
    DashboardComponent,
    FilterByParentPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    SearchPopupModule
  ],
  exports: [
    DashboardComponent
  ]
})
export class DashboardModule { }

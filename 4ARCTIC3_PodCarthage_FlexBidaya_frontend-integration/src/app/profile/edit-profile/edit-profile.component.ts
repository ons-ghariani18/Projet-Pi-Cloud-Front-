import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { UserService } from '../../services/user.service';

export interface EditProfileData {
  username: string;
  email: string;
  bio: string;
  profileImage: string;
}

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {
  @Output() profileUpdated = new EventEmitter<EditProfileData>();
  @Output() closeEditProfile = new EventEmitter<void>();

  editData: EditProfileData = {
    username: '',
    email: '',
    bio: '',
    profileImage: ''
  };

  originalData: EditProfileData = {
    username: '',
    email: '',
    bio: '',
    profileImage: ''
  };

  loading: boolean = false;
  error: string = '';
  success: string = '';

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadCurrentProfile();
  }

  loadCurrentProfile(): void {
    this.userService.getMyProfile().subscribe({
      next: (user) => {
        this.editData = {
          username: user.username || '',
          email: user.email || '',
          bio: user.bio || '',
          profileImage: user.profileImage || ''
        };
        this.originalData = { ...this.editData };
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.error = 'Error loading profile';
      }
    });
  }

  updateProfile(): void {
    this.error = '';
    this.success = '';

    // Validation
    if (!this.editData.username.trim()) {
      this.error = 'Username is required';
      return;
    }

    if (this.editData.username.length < 3) {
      this.error = 'Username must contain at least 3 characters';
      return;
    }

    this.loading = true;

    // Actual API call to update profile
    const profileUpdate = {
      username: this.editData.username,
      email: this.editData.email,
      bio: this.editData.bio,
      profileImage: this.editData.profileImage
    };

    this.userService.updateProfile(profileUpdate).subscribe({
      next: (response) => {
        this.success = 'Profile updated successfully!';
        this.loading = false;
        
        console.log('Profile updated successfully:', response);

        // Refresh data from backend (useful if username/email were normalized server-side)
        this.userService.getMyProfile().subscribe({
          next: (fresh) => {
            this.editData = {
              username: fresh.username || this.editData.username,
              email: fresh.email || this.editData.email,
              bio: fresh.bio || this.editData.bio,
              profileImage: fresh.profileImage || this.editData.profileImage
            };
            this.originalData = { ...this.editData };
          },
          error: () => {
            // Not blocking: we keep local data
          }
        });
        
        // Emit the update event after a short delay
        setTimeout(() => {
          this.profileUpdated.emit(this.editData);
          this.closeEditProfile.emit();
        }, 1500);
      },
      error: (error) => {
        console.error('Error updating profile (full response):', error);
        this.loading = false;
        
        // Handle different types of errors
        if (error.status === 400) {
          // Display the exact error message from the backend if it exists
          let errorMsg = 'Invalid data. Please check your information.';
          if (typeof error.error === 'string') {
            errorMsg = error.error;
          } else if (error.error && error.error.message) {
            errorMsg = error.error.message;
          } else if (error.error && error.error.errors) {
            errorMsg = JSON.stringify(error.error.errors);
          }
          this.error = errorMsg;
          console.error('Backend 400 Error:', error.error);
        } else if (error.status === 401) {
          this.error = 'Authentication error. Please log in again.';
        } else if (error.status === 403) {
          this.error = 'Permission denied to edit this profile.';
        } else if (error.status === 404) {
          this.error = 'User not found.';
        } else {
          this.error = 'Error updating profile. Please try again.';
        }
      }
    });
  }

  cancelEdit(): void {
    this.closeEditProfile.emit();
  }

  resetForm(): void {
    this.editData = { ...this.originalData };
    this.error = '';
    this.success = '';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        // Compress to avoid a payload too large (otherwise the backend may refuse / ignore the image)
        this.loading = true;
        this.compressImage(file, 0.6, 400)
          .then((compressed) => {
            if (compressed.length > 950000) {
              // Keep a margin compared to the backend check (1,000,000)
              return this.compressImage(file, 0.4, 300);
            }
            return compressed;
          })
          .then((compressed) => {
            this.editData.profileImage = compressed;
            this.error = '';
            this.loading = false;
          })
          .catch((e) => {
            console.error('Failed to compress image:', e);
            this.error = 'Could not process this image. Try a smaller image.';
            this.loading = false;
          });
      } else {
        this.error = 'Please select a valid image';
      }
    }
  }

  compressImage(file: File, quality: number = 0.1, maxWidth: number = 300): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        console.log('Original image size:', file.size, 'bytes');
        console.log('Original image dimensions:', img.width, 'x', img.height);
        
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        console.log('Resized dimensions:', width, 'x', height);
        
        // Draw the compressed image
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with strong compression
        let compressedImage = canvas.toDataURL('image/jpeg', quality);
        
        console.log('After first compression:', compressedImage.length, 'characters');
        
        // If still too large, reduce even more
        if (compressedImage.length > 500) {
          compressedImage = canvas.toDataURL('image/jpeg', 0.05);
          console.log('After second compression:', compressedImage.length, 'characters');
        }
        
        // If still too large, use PNG which can be smaller for some images
        if (compressedImage.length > 500) {
          compressedImage = canvas.toDataURL('image/png', 0.1);
          console.log('After PNG compression:', compressedImage.length, 'characters');
        }
        
        console.log('Final compressed size:', compressedImage.length, 'characters');
        resolve(compressedImage);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  removeProfileImage(): void {
    this.editData.profileImage = '';
  }

  hasChanges(): boolean {
    return JSON.stringify(this.editData) !== JSON.stringify(this.originalData);
  }
}

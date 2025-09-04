import { Injectable } from '@nestjs/common';

@Injectable()
export class UrlService {
  getBaseUrl(): string {
    return process.env.VERCEL 
      ? 'https://busy-fool-backend.vercel.app'
      : 'http://localhost:3000';
  }

  getProfilePictureUrl(filename: string): string {
    return `${this.getBaseUrl()}/auth/profile-picture/${filename}`;
  }

  getProductImageUrl(filename: string): string {
    return `${this.getBaseUrl()}/products/image/${filename}`;
  }
}
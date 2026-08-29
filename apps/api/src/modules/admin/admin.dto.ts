import { Type } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString() email!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() role?: string;
}

export class MembershipDto {
  @IsString() email!: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() password?: string;
}

export class UpdateMembershipDto {
  @IsOptional() @IsString() role?: string;
}

export class BranchDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ConfigDto {
  @IsString() key!: string;
  @IsObject() value!: any;
  @IsOptional() @IsString() description?: string;
}

export class CreateTenantUserDto {
  @IsString() email!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @Type(() => Number) companyCount?: number;
}
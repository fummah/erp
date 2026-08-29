import { IsEmail, IsString } from 'class-validator';
export class LoginDto { @IsEmail() email!:string; @IsString() password!:string }
export class SwitchCompanyDto { @IsString() companyId!:string }

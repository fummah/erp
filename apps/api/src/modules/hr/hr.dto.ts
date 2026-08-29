import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class EmployeeDto {
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() email?: string;
  @IsString() hireDate!: string;
  @Type(() => Number) @IsNumber() basicSalary!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsObject() allowances?: any;
  @IsOptional() @IsObject() deductions?: any;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class LeaveDto {
  @IsString() employeeId!: string;
  @IsOptional() @IsString() leaveType?: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @Type(() => Number) @IsNumber() days!: number;
  @IsOptional() @IsString() reason?: string;
}

export class AttendanceDto {
  @IsString() employeeId!: string;
  @IsString() date!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsString() note?: string;
}

export class PayrollRunDto {
  @Type(() => Number) @IsNumber() period!: number;
  @Type(() => Number) @IsNumber() year!: number;
}

export class StatutoryDto {
  @IsString() country!: string;
  @IsString() authority!: string;
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() validFrom!: string;
  @IsOptional() @IsString() validTo?: string;
  @IsObject() configuration!: any;
}
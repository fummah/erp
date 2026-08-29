import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AccountDto {
  @IsOptional() @IsString() code?: string;
  @IsString() name!: string;
  @IsString() type!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class JournalLineDto {
  @IsString() accountId!: string;
  @Type(() => Number) @IsNumber() debit!: number;
  @Type(() => Number) @IsNumber() credit!: number;
  @IsOptional() @IsString() description?: string;
}

export class CreateJournalDto {
  @IsOptional() @IsString() date?: string;
  @IsString() description!: string;
  @IsOptional() @IsString() reference?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => JournalLineDto) lines!: JournalLineDto[];
}

export class BudgetDto {
  @Type(() => Number) @IsNumber() fiscalYear!: number;
  @Type(() => Number) @IsNumber() period!: number;
  @IsString() accountId!: string;
  @Type(() => Number) @IsNumber() amount!: number;
}

export class TaxRateDto {
  @IsOptional() @IsString() code?: string;
  @IsString() name!: string;
  @Type(() => Number) @IsNumber() rate!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
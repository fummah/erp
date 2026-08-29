import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ItemDto {
  @IsOptional() @IsString() sku?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() hsCode?: string;
  @IsOptional() @Type(() => Number) @IsNumber() reorderLevel?: number;
  @IsOptional() @IsBoolean() trackBatch?: boolean;
  @IsOptional() @IsBoolean() trackSerial?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class WarehouseDto {
  @IsString() branchId!: string;
  @IsOptional() @IsString() code?: string;
  @IsString() name!: string;
}

export class CreateMovementDto {
  @IsString() warehouseId!: string;
  @IsString() itemId!: string;
  @IsString() type!: string;
  @Type(() => Number) @IsNumber() quantity!: number;
  @IsOptional() @Type(() => Number) @IsNumber() unitCost?: number;
  @IsOptional() @IsString() reference?: string;
}

export class TransferDto {
  @IsString() fromWarehouseId!: string;
  @IsString() toWarehouseId!: string;
  @IsString() itemId!: string;
  @Type(() => Number) @IsNumber() quantity!: number;
  @IsOptional() @IsString() reference?: string;
}

export class CountLineDto {
  @IsString() itemId!: string;
  @Type(() => Number) @IsNumber() countedQty!: number;
}

export class CreateCountDto {
  @IsString() warehouseId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CountLineDto) lines!: CountLineDto[];
}

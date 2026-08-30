import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ItemDto {
  @IsOptional() @IsString() sku?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() hsCode?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() salesDescription?: string;
  @IsOptional() @IsString() purchaseDescription?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() itemCategory?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @Type(() => Number) @IsNumber() reorderLevel?: number;
  @IsOptional() @Type(() => Number) @IsNumber() reorderQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() safetyStock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() sellingPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minSellingPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() purchaseCost?: number;
  @IsOptional() @IsString() costingMethod?: string;
  @IsOptional() @IsBoolean() trackBatch?: boolean;
  @IsOptional() @IsBoolean() trackSerial?: boolean;
  @IsOptional() @IsBoolean() trackExpiry?: boolean;
  @IsOptional() @IsString() salesTaxCode?: string;
  @IsOptional() @IsString() purchaseTaxCode?: string;
  @IsOptional() @IsString() incomeAccountId?: string;
  @IsOptional() @IsString() cogsAccountId?: string;
  @IsOptional() @IsString() inventoryAssetAccountId?: string;
  @IsOptional() @IsString() expenseAccountId?: string;
  @IsOptional() @IsString() adjustmentAccountId?: string;
  @IsOptional() @IsString() defaultWarehouseId?: string;
  @IsOptional() @IsString() preferredSupplierId?: string;
  @IsOptional() @IsString() supplierSku?: string;
  @IsOptional() @Type(() => Number) @IsNumber() leadTimeDays?: number;
  @IsOptional() @IsBoolean() allowDiscount?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PriceListDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() customerGroup?: string;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() effectiveTo?: string;
}

export class InventoryCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() incomeAccountId?: string;
  @IsOptional() @IsString() cogsAccountId?: string;
  @IsOptional() @IsString() inventoryAssetAccountId?: string;
  @IsOptional() @IsString() expenseAccountId?: string;
  @IsOptional() @IsString() salesTaxCode?: string;
  @IsOptional() @IsString() purchaseTaxCode?: string;
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

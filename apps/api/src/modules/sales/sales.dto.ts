import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class InvoiceLineDto {
  @IsString() description!: string;
  @Type(() => Number) @IsNumber() quantity!: number;
  @Type(() => Number) @IsNumber() unitPrice!: number;
  @Type(() => Number) @IsNumber() taxRate!: number;
  @IsOptional() @IsString() hsCode?: string;
  @IsOptional() @IsString() itemId?: string;
}

export class CreateInvoiceDto {
  @IsString() branchId!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() invoiceNo?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() fiscalRequired?: boolean;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() invoiceDate?: string;
  @IsOptional() @IsString() terms?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() statementMemo?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() customerReference?: string;
  @IsOptional() @IsString() poReference?: string;
  @IsOptional() @IsString() salesperson?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto) lines!: InvoiceLineDto[];
}

export class DocLineDto {
  @IsString() description!: string;
  @IsOptional() @IsString() itemId?: string;
  @Type(() => Number) @IsNumber() quantity!: number;
  @Type(() => Number) @IsNumber() unitPrice!: number;
  @Type(() => Number) @IsNumber() taxRate!: number;
}

export class CreateQuotationDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() statementMemo?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() status?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DocLineDto) lines!: DocLineDto[];
}

export class CreateSalesOrderDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() quotationId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DocLineDto) lines!: DocLineDto[];
}

export class CreateReceiptDto {
  @IsOptional() @IsString() invoiceId?: string;
  @IsOptional() @IsString() receiptDate?: string;
  @Type(() => Number) @IsNumber() amount!: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() referenceNo?: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateCreditNoteDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() invoiceId?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() creditNoteDate?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DocLineDto) lines!: DocLineDto[];
}

export class CustomerDto {
  @IsOptional() @IsString() code?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() address1?: string;
  @IsOptional() @IsString() address2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() zip?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() taxStatus?: string;
  @IsOptional() @Type(() => Number) @IsNumber() defaultTaxRate?: number;
  @IsOptional() @IsString() tin?: string;
  @IsOptional() @IsString() vatNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() creditLimit?: number;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class StatusDto {
  @IsString() status!: string;
}

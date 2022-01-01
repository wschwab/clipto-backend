import { IsNumber, IsString } from 'class-validator';
export class FinishRequestDto {
  @IsNumber()
  id: number;
  @IsString()
  txHash: string;
}

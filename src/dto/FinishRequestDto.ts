import { IsEthereumAddress, IsNumber, IsString } from 'class-validator';
export class FinishRequestDto {
  @IsNumber()
  id: number;
  @IsString()
  txHash: string;
  @IsEthereumAddress()
  creatorAddress: string;
}

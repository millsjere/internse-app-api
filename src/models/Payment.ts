import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  company: mongoose.Types.ObjectId;
  reference: string;
  invoiceNumber: string;
  planType: string;
  planDisplayName: string;
  amount: number;
  currency: string;
  billingCycle: string;
  status: 'success' | 'failed' | 'pending';
  paidAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    company:        { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    reference:      { type: String, required: true, unique: true },
    invoiceNumber:  { type: String, required: true, unique: true },
    planType:       { type: String, required: true },
    planDisplayName:{ type: String, required: true },
    amount:         { type: Number, required: true },
    currency:       { type: String, default: 'GHS' },
    billingCycle:   { type: String, default: 'monthly' },
    status:         { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
    paidAt:         { type: Date },
    periodStart:    { type: Date },
    periodEnd:      { type: Date },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

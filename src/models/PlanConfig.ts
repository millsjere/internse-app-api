import { Schema, model, Document } from 'mongoose';

export interface IPlanConfig extends Document {
  planType: string;
  displayName: string;
  currency: string;
  monthlyPrice: number;
  annualPrice: number;
  credits: number;
  resetsMonthly: boolean;
  teamSeats: number;
  featuredListings: number;
  features: string[];
  isPopular: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const planConfigSchema = new Schema<IPlanConfig>(
  {
    planType:         { type: String, required: true, unique: true },
    displayName:      { type: String, required: true },
    currency:         { type: String, default: 'USD' },
    monthlyPrice:     { type: Number, required: true },
    annualPrice:      { type: Number, required: true },
    credits:          { type: Number, required: true },
    resetsMonthly:    { type: Boolean, default: true },
    teamSeats:        { type: Number, default: 1 },
    featuredListings: { type: Number, default: 0 },
    features:         { type: [String], default: [] },
    isPopular:        { type: Boolean, default: false },
    order:            { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PlanConfig = model<IPlanConfig>('PlanConfig', planConfigSchema);

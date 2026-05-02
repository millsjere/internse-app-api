import { Schema, model } from 'mongoose';
import { IFavourite } from '../types';

const favouriteSchema = new Schema<IFavourite>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  },
  { timestamps: true }
);

// Unique index: one favourite per user per job
favouriteSchema.index({ user: 1, job: 1 }, { unique: true });
favouriteSchema.index({ user: 1 });

export const Favourite = model<IFavourite>('Favourite', favouriteSchema);

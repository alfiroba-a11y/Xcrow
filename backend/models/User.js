const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const bankDetailsSchema = new mongoose.Schema(
  {
    bankCode: String,
    bankName: String,
    accountNumber: String,
    accountName: String,
    recipientCode: String, // Paystack transfer recipient code
    method: { type: String, enum: ['bank', 'mobile_money'], default: 'bank' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    bankDetails: bankDetailsSchema,
    lastLoginAt: Date,
    lastLoginIp: String,
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    hasBankDetails: !!(this.bankDetails && this.bankDetails.recipientCode),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);

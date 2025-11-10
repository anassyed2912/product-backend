import mongoose, { Document, Model } from "mongoose";
import bcrypt from "bcryptjs";


export interface IUser extends Document {
  email: string;
  password: string;
  comparePassword(candidate: string): Promise<boolean>;
}


const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});


userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};


const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;

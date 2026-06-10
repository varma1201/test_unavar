import mongoose from "mongoose";
import colors from "colors";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`Connected to MongoDB Database`.bgMagenta.white);
  } catch (error) {
    console.log(`Error connecting to MongoDB: ${error.message}`.bgRed.white);
    process.exit(1); // Exit the process with failure
  }
};

export default connectDB;

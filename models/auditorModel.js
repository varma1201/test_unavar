import mongoose  from "mongoose";

const {Schema,model}=mongoose;

const auditorSchema=new Schema({

    auditor_name:{
        type:String,
    }
})

const Auditor=model("Auditor",auditorSchema);

export default Auditor;
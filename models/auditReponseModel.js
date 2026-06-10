import mongoose from 'mongoose';

const {Schema,model}=mongoose;

const auditResponseSchema = new Schema({
    audit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AuditMangement',
        required: true
    },
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    comment: {
        type: String,
        default: ''
    },
    marks: {
        type: String,
        
    },
    image_url: {
        type: String, 
        default: ''
    }
}, {
    timestamps: true
});
// Check if the model is already registered before defining it
const AuditResponse =model('AuditResponse', auditResponseSchema);

export default AuditResponse;

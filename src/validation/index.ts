/**
 * Validation Module - Centralized validation and constraints
 * 
 * Provides convenient access to all validation functions.
 */

export {
    ValidationResult,
    ConstraintViolation,
    validateTrack,
    validateTrackFilePath,
    validateCratePrompt,
    validateDerivedIntent,
    validateCratePlan,
    validatePlanForFinalization,
    validateTrackFilter,
    satisfiesBPMConstraint,
    satisfiesDurationConstraint,
    satisfiesEnergyConstraint,
    satisfiesAllConstraints,
    getConstraintViolations
} from './constraints';

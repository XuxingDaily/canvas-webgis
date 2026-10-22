import { Feature } from "../core/feature/Feature";
import { Field } from "../core/feature/Field";

export interface AdaptedFeatureSet {
    readonly features: Feature[];
    readonly fields: Field[];
}

/** 将外部格式适配为内部 Feature 模型。 */
export interface FeatureAdapter<TInput> {
    adapt(input: TInput): AdaptedFeatureSet;
}

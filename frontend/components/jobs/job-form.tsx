import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import { Experiment, ModelType, JobParameters } from "@/lib/store";
import { jobApi } from "@/lib/api";
import { useStore } from "@/lib/store";

const baseParametersSchema = z.object({
	model_type: z.enum(["mlp", "cnn", "rnn"]),
	optimizer: z.enum(["sgd", "adam", "rmsprop"]),
	learning_rate: z.number().min(0.00001).max(1),
	batch_size: z.number().int().min(1).max(1024),
	epochs: z.number().int().min(1).max(100),
	dropout_rate: z.number().min(0).max(0.9).optional(),
	hidden_size: z.number().int().min(1).max(1024).optional(),
	use_scheduler: z.boolean().optional(),
});

const mlpParametersSchema = baseParametersSchema.extend({
	num_layers: z.number().int().min(1).max(10),
});

const cnnParametersSchema = baseParametersSchema.extend({
	kernel_size: z.number().int().min(1).max(7),
});

const rnnParametersSchema = baseParametersSchema.extend({
	num_layers: z.number().int().min(1).max(10),
});

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	model_type: z.enum(["mlp", "cnn", "rnn"]),
	experiment_id: z.number(),
	parameters: z.discriminatedUnion("model_type", [
		mlpParametersSchema.extend({ model_type: z.literal("mlp") }),
		cnnParametersSchema.extend({ model_type: z.literal("cnn") }),
		rnnParametersSchema.extend({ model_type: z.literal("rnn") }),
	]),
});

type FormValues = z.infer<typeof formSchema>;

type ModelDefaults = {
	mlp: {
		hidden_size: number;
		dropout_rate: number;
		num_layers: number;
	};
	cnn: {
		hidden_size: number;
		dropout_rate: number;
		kernel_size: number;
	};
	rnn: {
		hidden_size: number;
		dropout_rate: number;
		num_layers: number;
	};
};

const modelDefaults: ModelDefaults = {
	mlp: {
		hidden_size: 128,
		dropout_rate: 0.2,
		num_layers: 2,
	},
	cnn: {
		hidden_size: 64,
		dropout_rate: 0.25,
		kernel_size: 3,
	},
	rnn: {
		hidden_size: 128,
		dropout_rate: 0.3,
		num_layers: 1,
	},
};

interface JobFormProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	experiment: Experiment;
}

export function JobForm({ open, onOpenChange, experiment }: JobFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { jobs, setJobs } = useStore();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: `Job ${new Date().toLocaleString()}`,
			model_type: "mlp" as ModelType,
			experiment_id: experiment.id,
			parameters: {
				model_type: "mlp" as ModelType,
				optimizer: "adam",
				learning_rate: 0.001,
				batch_size: 64,
				epochs: 10,
				...modelDefaults.mlp,
				use_scheduler: false,
			},
		},
	});

	const watchModelType = form.watch("model_type");

	const updateModelSpecificFields = (modelType: ModelType) => {
		form.setValue("parameters.model_type", modelType);

		if (modelType === "cnn") {
			form.setValue("parameters.hidden_size", modelDefaults.cnn.hidden_size);
			form.setValue("parameters.dropout_rate", modelDefaults.cnn.dropout_rate);
			form.setValue("parameters.kernel_size", modelDefaults.cnn.kernel_size);
			form.unregister("parameters.num_layers");
		} else if (modelType === "mlp" || modelType === "rnn") {
			const defaults =
				modelType === "mlp" ? modelDefaults.mlp : modelDefaults.rnn;
			form.setValue("parameters.hidden_size", defaults.hidden_size);
			form.setValue("parameters.dropout_rate", defaults.dropout_rate);
			form.setValue("parameters.num_layers", defaults.num_layers);
			form.unregister("parameters.kernel_size");
		}
	};

	const onSubmit = async (data: FormValues) => {
		setIsSubmitting(true);

		try {
			data.parameters.model_type = data.model_type;

			if (data.model_type === "mlp") {
				const mlpParams = data.parameters as z.infer<
					typeof mlpParametersSchema
				>;
				console.log("Submitting MLP job with parameters:", {
					...data.parameters,
					num_layers: mlpParams.num_layers,
				});
			}

			let cleanedParameters: JobParameters;

			if (data.model_type === "cnn") {
				const cnnParams = data.parameters as z.infer<
					typeof cnnParametersSchema
				>;
				cleanedParameters = {
					model_type: data.parameters.model_type,
					optimizer: data.parameters.optimizer,
					learning_rate: data.parameters.learning_rate,
					batch_size: data.parameters.batch_size,
					epochs: data.parameters.epochs,
					dropout_rate: data.parameters.dropout_rate,
					hidden_size: data.parameters.hidden_size,
					use_scheduler: data.parameters.use_scheduler,
					kernel_size: cnnParams.kernel_size,
				};
			} else if (data.model_type === "mlp" || data.model_type === "rnn") {
				const layerParams = data.parameters as
					| z.infer<typeof mlpParametersSchema>
					| z.infer<typeof rnnParametersSchema>;
				cleanedParameters = {
					model_type: data.parameters.model_type,
					optimizer: data.parameters.optimizer,
					learning_rate: data.parameters.learning_rate,
					batch_size: data.parameters.batch_size,
					epochs: data.parameters.epochs,
					dropout_rate: data.parameters.dropout_rate,
					hidden_size: data.parameters.hidden_size,
					use_scheduler: data.parameters.use_scheduler,
					num_layers: layerParams.num_layers,
				};
			} else {
				cleanedParameters = {
					...data.parameters,
				};
			}

			const payload = {
				...data,
				parameters: cleanedParameters,
			};

			const newJob = await jobApi.create(payload);
			console.log("Job API response:", newJob);

			const jobAlreadyExists = newJob.name !== data.name;

			if (jobAlreadyExists) {
				console.log("Received existing job instead of creating a new one");
				toast.warning(`Job with these parameters already exists`, {
					description: `Using existing job "${newJob.name}" with identical parameters.`,
				});
			} else {
				console.log("New job created successfully");
				toast.success(`Job "${newJob.name}" created`, {
					description: `${data.model_type.toUpperCase()} model with ${
						data.parameters.epochs
					} epochs. Started training and added to queue.`,
				});
			}

			setJobs([...jobs, newJob]);

			setTimeout(async () => {
				try {
					console.log("Refreshing jobs for experiment:", experiment.id);
					const refreshedJobs = await jobApi.getAll(experiment.id);
					console.log("Refreshed jobs:", refreshedJobs);
					setJobs(refreshedJobs);
				} catch (error) {
					console.error("Error refreshing jobs:", error);
				}
			}, 500);

			onOpenChange(false);
			form.reset();
		} catch (error) {
			console.error("Error creating job:", error);
			toast.error("Failed to create job", {
				description: "There was an error creating your job. Please try again.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderModelSpecificParams = () => {
		switch (watchModelType) {
			case "cnn":
				return (
					<>
						<h4 className="text-base font-medium mt-4">
							CNN-Specific Parameters
						</h4>
						<div className="space-y-4 mt-2">
							<FormField
								control={form.control}
								name="parameters.kernel_size"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Kernel Size: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value || 3]}
												min={1}
												max={7}
												step={2}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Size of the convolutional kernel.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</>
				);
			case "mlp":
			case "rnn":
				return (
					<>
						<h4 className="text-base font-medium mt-4">
							{watchModelType === "mlp" ? "MLP" : "RNN"}-Specific Parameters
						</h4>
						<div className="space-y-4 mt-2">
							<FormField
								control={form.control}
								name="parameters.num_layers"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Number of Layers: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value || 2]}
												min={1}
												max={10}
												step={1}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Number of hidden layers in the network.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</>
				);
			default:
				return null;
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create New Training Job</DialogTitle>
					<DialogDescription>
						Configure your model and training parameters.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<div className="space-y-4">
							<h3 className="text-lg font-medium">Basic Information</h3>

							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Job Name</FormLabel>
										<FormControl>
											<Input placeholder="My Job" {...field} />
										</FormControl>
										<FormDescription>
											A descriptive name for this training job.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="model_type"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Model Type</FormLabel>
										<Select
											onValueChange={(value: ModelType) => {
												field.onChange(value);

												updateModelSpecificFields(value);
											}}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a model type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="mlp">
													Multi-Layer Perceptron (MLP)
												</SelectItem>
												<SelectItem value="cnn">
													Convolutional Neural Network (CNN)
												</SelectItem>
												<SelectItem value="rnn">
													Recurrent Neural Network (RNN)
												</SelectItem>
											</SelectContent>
										</Select>
										<FormDescription>
											The type of neural network architecture to use.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<Separator />

						<div className="space-y-4">
							<h3 className="text-lg font-medium">Common Parameters</h3>

							<FormField
								control={form.control}
								name="parameters.optimizer"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Optimizer</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select an optimizer" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="sgd">SGD</SelectItem>
												<SelectItem value="adam">Adam</SelectItem>
												<SelectItem value="rmsprop">RMSprop</SelectItem>
											</SelectContent>
										</Select>
										<FormDescription>
											The optimization algorithm to use for training.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="parameters.learning_rate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Learning Rate: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value]}
												min={0.00001}
												max={0.1}
												step={0.00001}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Controls how quickly the model adapts to the problem.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="parameters.batch_size"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Batch Size: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value]}
												min={8}
												max={256}
												step={8}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Number of samples processed before the model is updated.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="parameters.epochs"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Epochs: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value]}
												min={1}
												max={50}
												step={1}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Number of complete passes through the training dataset.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="parameters.dropout_rate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Dropout Rate: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value || 0.2]}
												min={0}
												max={0.9}
												step={0.05}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Fraction of neurons randomly turned off during training.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="parameters.hidden_size"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Hidden Size: {field.value}</FormLabel>
										<FormControl>
											<Slider
												defaultValue={[field.value || 128]}
												min={16}
												max={512}
												step={16}
												onValueChange={(value) => field.onChange(value[0])}
											/>
										</FormControl>
										<FormDescription>
											Number of neurons in hidden layers.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Render model-specific parameters */}
							{renderModelSpecificParams()}

							<FormField
								control={form.control}
								name="parameters.use_scheduler"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												Learning Rate Scheduler
											</FormLabel>
											<FormDescription>
												Automatically adjust learning rate during training.
											</FormDescription>
										</div>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Creating..." : "Create Job"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

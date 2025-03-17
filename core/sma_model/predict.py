import os
import sys
import joblib

modelPath = sys.argv[1]   # Model file path passed as first argument
input_data = eval(sys.argv[2])  # Input data file path passed as second argument

model = joblib.load(modelPath)

def predict(input):
    return model.predict(input)

if __name__ == "__main__":
    # Read input data from file
    input_data = [d for d in input_data]

    # Call predict function to generate output
    predictions = predict(input_data)[0]

    # Send output data to stdout as JSON
    sys.stdout.write(str(predictions))
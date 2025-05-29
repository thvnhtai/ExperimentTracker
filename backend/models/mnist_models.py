import torch
import torch.nn as nn
import torch.nn.functional as F


class SimpleCNN(nn.Module):
    def __init__(self, dropout_rate=0.5, hidden_size=128, kernel_size=3):
        super(SimpleCNN, self).__init__()
        self.conv1 = nn.Conv2d(1, 32, kernel_size=kernel_size)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=kernel_size)
        
        self.fc1 = nn.Linear(64 * 5 * 5, hidden_size)
        
        self.dropout = nn.Dropout(dropout_rate)
        self.fc2 = nn.Linear(hidden_size, 10)
    
    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = F.max_pool2d(x, 2)
        x = F.relu(self.conv2(x))
        x = F.max_pool2d(x, 2)
        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return F.log_softmax(x, dim=1)


class SimpleNN(nn.Module):
    def __init__(self, hidden_size=512, dropout_rate=0.2, num_layers=2):
        super(SimpleNN, self).__init__()
        
        layers = []
        
        layers.append(nn.Linear(28 * 28, hidden_size))
        layers.append(nn.ReLU())
        layers.append(nn.Dropout(dropout_rate))
        
        for _ in range(num_layers - 1):
            layers.append(nn.Linear(hidden_size, hidden_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout_rate))
        
        layers.append(nn.Linear(hidden_size, 10))
        
        self.model = nn.Sequential(*layers)
    
    def forward(self, x):
        x = torch.flatten(x, 1)
        x = self.model(x)
        return F.log_softmax(x, dim=1)
    
class SimpleRNN(nn.Module):
    def __init__(self, hidden_size=128, num_layers=1, dropout_rate=0.3):
        super(SimpleRNN, self).__init__()
        self.rnn = nn.LSTM(
            input_size=28,         
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout_rate if num_layers > 1 else 0,
            batch_first=True
        )
        
        self.dropout = nn.Dropout(dropout_rate)
        self.fc = nn.Linear(hidden_size, 10)
    
    def forward(self, x):
        x = x.squeeze(1)
        
        x, _ = self.rnn(x)
        
        x = x[:, -1, :]
        
        x = self.dropout(x)
        x = self.fc(x)
        return F.log_softmax(x, dim=1)


def create_model(model_type="cnn", **kwargs):
    if model_type.lower() == "cnn":
        valid_params = ["dropout_rate", "hidden_size", "kernel_size"]
        filtered_kwargs = {k: v for k, v in kwargs.items() if k in valid_params}
        return SimpleCNN(**filtered_kwargs)
    
    elif model_type.lower() == "nn" or model_type.lower() == "mlp":
        valid_params = ["hidden_size", "dropout_rate", "num_layers"]
        filtered_kwargs = {k: v for k, v in kwargs.items() if k in valid_params}
        return SimpleNN(**filtered_kwargs)
    
    elif model_type.lower() == "rnn":
        valid_params = ["hidden_size", "dropout_rate", "num_layers"]
        filtered_kwargs = {k: v for k, v in kwargs.items() if k in valid_params}
        return SimpleRNN(**filtered_kwargs)
    
    else:
        raise ValueError(f"Model type {model_type} not supported")
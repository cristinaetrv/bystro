"""
This provides the base class of any reduced rank regression model, whether 
it be vanilla or some of the penalized extensions. This only creates the 
base methods that can be used independent of inference strategy. 

Implementing an extension model requires that the following methods be 
implemented
    fit - Learns the model given data 

Objects
-------
BaseReducedRankRegression()
    Base class with some methods used by any reduced rank regression model

BaseReducedRankRegressionSGD(BaseReducedRankRegression)
    Base class for any pytorch-based inference scheme as opposed to cvxpy

Methods
-------
def cross_entropy_prod(Y,Y_pred):
    This method evaluates the cross-entropy loss on each of the predicted
    variables

return_optimizer_pt(training_parameters,training_options)
    This returns the optimizer object for pytorch stochastic gradient descent.

"""
import numpy as np
import torch
from numpy import linalg as la
from datetime import datetime as dt


class BaseReducedRankRegression(object):
    def get_nuclear_norm(self):
        """ 
        Returns the nuclear norm of the coefficients, a convex relaxation 
        of the ``rank''.

        Parameters
        ----------
        None

        Returns
        -------
        nuclear_norm : float
            The nuclear norm
        """
        nuclear_norm = la.norm(self.B, ord="nuc")
        return nuclear_norm

    def decision_function(self, X):
        """ 
        Predicts Y given learned coefficients B

        Parameters
        ----------
        X : np.array-like,shape=(N,p)
            The predictor variables

        Returns
        -------
        Y_hat : np.array-like,shape=(N,q)
            The predicted values
        """
        Y_hat = np.dot(X, self.B) + self.A
        return Y_hat

    def decision_function_subset(self, X, idxs):
        """
        Predicts Y given learned coefficients B

        Parameters
        ----------
        X : np.array-like,shape=(N,sum(idxs))
            The subset predictor variables

        idxs : np.array-like,shape=(self.p,)
            The covariates to consider

        Returns
        -------
        Y_hat : np.array-like,shape=(N,q)
            The predicted values
        """
        B_sub = self.B[idxs == 1]
        Y_hat = np.dot(X, B_sub) + self.A
        return Y_hat

    def pickle(self, fileName):
        """
        Saves a (trained) model

        Parameters
        ----------
        fileName : string
            What the file name you save it to is

        Returns
        -------
        None
        """
        myDict = {"model": self}
        cloudpickle.dump(myDict, open(fileName, "wb"))

    def save_coefficients_csv(self, fileName):
        """
        Saves the coefficient matrix as csv files.

        Parameters
        ----------
        fileName : string
            Saving the file as a csv.

        Returns
        -------
        None
        """
        if hasattr(self, "B"):
            np.savetxt(fileName + "_B.csv", self.B, fmt="%0.8f", delimiter=",")
            np.savetxt(fileName + "_A.csv", self.A, fmt="%0.8f", delimiter=",")
        else:
            print("Model not fitted")


class BaseReducedRankRegressionSGD(BaseReducedRankRegression):
    def __init__(self, training_options={}):
        self.training_options = self._fill_training_options(training_options)

        self.creationDate = dt.now()

    def _initialize_losses(self):
        """
        This initializes the arrays to store losses

        Attributes
        ----------
        losses : np.array,size=(td['n_iterations'],)
            Total loss including regularization terms

        losses_recon : np.array,size=(td['n_iterations'],)
            Prediction loss

        losses_reg : np.array,size=(td['n_iterations'],)
            Regularization
        """
        n_iterations = self.training_options["n_iterations"]
        self.losses = np.zeros(n_iterations)
        self.losses_recon = np.zeros(n_iterations)
        self.losses_reg = np.zeros(n_iterations)

    def _save_losses(self, i, loss, loss_recon, loss_reg):
        """
        This saves the respective losses at each iteration

        Parameters
        ----------
        i : int 
            The current iteration

        loss : tf.Float
            The total loss minimized by optimizer

        loss_recon : tf.Float
            The reconstruction loss

        loss_reg : tf.Foat
            The nuclear norm loss
        """
        self.losses[i] = loss.detach().numpy()
        self.losses_recon[i] = loss_recon.detach().numpy()
        self.losses_reg[i] = loss_reg.detach().numpy()

    def _fill_training_options(self, training_options):
        """
        This fills the default learning parameters of the model such as 
        learning rate etc.

        Parameters
        ----------

        Returns
        -------
        """
        default_dict = {
            "learning_rate": 1e-3,
            "method": "Nadam",
            "momentum": 0.9,
            "decay_options": {
                "decay": "exponential",
                "steps": 500,
                "rate": 0.96,
                "staircase": True,
            },
            "gpu_memory": 1024,
            "n_iterations": 5000,
            "batch_size": 512,
            "adaptive": False,
        }
        return fill_dict(training_options, default_dict)

    def _transform_training_data(self, X, Y):
        """
        This converts training data to adequate format with rudimentary
        check on values

        Parameters
        ----------
        X : np.array-like,shape=(N,p)
            The predictor variables, should be demeaned

        Y : np.array-like,shape=(N,q)
            The variables we wish to predict, should be demeaned

        Returns
        -------
        X : np.array-like,shape=(N,p)
            The predictor variables, should be demeaned

        Y : np.array-like,shape=(N,q)
            The variables we wish to predict, should be demeaned
        """
        if X.shape[0] != Y.shape[0]:
            raise ValueError("Samples X != Samples Y")

        self.n_samples, self.p = X.shape
        self.q = Y.shape[1]
        X = torch.tensor(X)
        Y = torch.tensor(Y)
        return X, Y


def cross_entropy_prod(Y, Y_pred):
    """
    This method evaluates the cross-entropy loss on each of the predicted
    variables

    Parameters
    ----------
    Y : torch.Tensor,shape=(N,p)
        The true binary values

    Y : torch.Tensor,shape=(N,q)
        The variables we wish to predict, should be demeaned

    Returns
    -------
    loss : torch.Tensor
        The predictive loss
    """
    q = Y_pred.shape[1]
    cross_entropy = torch.nn.CrossEntropyLoss()
    loss_individuals = [cross_entropy(Y_pred[:, i], Y[:, i]) for i in range(q)]
    loss = torch.stack(loss_individuals).sum()
    return loss


def return_optimizer_pt(training_parameters, training_options):
    """
    This returns the optimizer object for pytorch stochastic gradient descent.

    Returns
    -------
    optimizer 
    """
    if training_options["method"] == "Momentum":
        optimizer = torch.optim.SGD(
            training_parameters,
            lr=training_options["learning_rate"],
            momentum=training_options["momentum"],
        )
    elif training_options["method"] == "Adam":
        optimizer = torch.optim.Adam(
            training_parameters, lr=training_options["learning_rate"]
        )
    elif training_options["method"] == "NAdam":
        optimizer = torch.optim.NAdam(
            training_parameters, lr=training_options["learning_rate"]
        )
    elif training_options["method"] == "SGD":
        optimizer = torch.optim.SGD(
            training_parameters,
            lr=training_options["learning_rate"],
            momentum=0.0,
        )
    else:
        raise ValueError(
            "Unrecognized optimizer %s" % training_options["method"]
        )

    return optimizer

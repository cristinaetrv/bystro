"""
This implements several versions of reduced rank regression in Pytorch. The
first is true reduced rank regression where the coefficients are decomposed
into B=UV where U in R^pxl and V in R^lxq. The second version instead uses 
a full-rank B but with a nuclear norm constraint on the coefficients. This 
corresponds to a convex relaxation of the first problem, which is guaranteed
to have a unique minimum. The third implementation decomposes the 
coefficients into an approximately low rank and approximately sparse matrix
that is more robust to outliers.

Objects
-------
LogisticReducedRank(L=1,training_options={},prior_options={})
    min_U,V Loss(Y,XUV) + Loss(U) + Loss(V)

LogisticReducedNorm(mu=1.0,training_options={})
    min_U,V Loss(Y,XB) + mu*norm(B)_nuc 

LogisticSparseLowRank(mul=1.0,mus=1.0,training_options={})
        This decomposes regression into a low rank and sparse component
        min Loss(Y,XB) + mu*norm(L)_nuc + mus*norm(S)_1
        s.t B = L + S

Methods
-------
None
"""
import numpy as np
import numpy.random as rand

import torch
from torch import nn

from ._base import (
    BaseReducedRankRegressionSGD,
    return_optimizer_pt,
    cross_entropy_prod,
)


class LogisticReducedRank(BaseReducedRankRegressionSGD):
    def __init__(self, L=1, training_options={}, prior_options={}):
        """
        This fits an explicit low rank model, which is not convex but 
        allows for explicit interpretation of the coefficients in terms 
        of basis vectors.

        Attributes
        ----------
        L : int,default=1
            The rank of the predictive coefficients

        Usage
        -----
        N = 10000
        p,q,R = 30,5,2
        sigma = 1.0
        U = rand.randn(p,R)
        V = rand.randn(R,q)

        B = np.dot(U,V)
        X = rand.randn(N,p)
        Y_hat = np.dot(X,B)
        Y = Y_hat + sigma*rand.randn(N,q)

        model = RRR_dual_tf()
        model.fit(X,Y)
        y_pred = model.predict(X,K=10.0)
        mse = np.mean((y_pred-Y)**2)
        """
        self.L = int(L)
        super().__init__(training_options=training_options)
        self.prior_options = self._fill_prior_options(prior_options)

    def fit(self, X, Y, progress_bar=True, seed=2021):
        """ 
        Fits a model given covariates X and response Y.

        Parameters
        ----------
        X : np.array-like,(n_samples,n_covariates)
            The data

        Y : np.array-like,(n_samples,n_response)
            The response variables

        progress_bar : bool,default=True
            Whether to print the progress bar to monitor time

        Returns
        -------
        self : object
            The model
        """
        rand.seed(seed)
        td = self.training_options
        N, self.p = X.shape
        _, self.q = Y.shape
        X, Y = self._transform_training_data(X, Y)

        optimizer = return_optimizer_pt(trainable_variables, td)

        trainable_variables = self._initialize_trainable_variables(X, Y)
        U_, V_, A_ = (
            trainable_variables[0],
            trainable_variables[1],
            trainable_variables[2],
        )

        self._initialize_losses()

        prior_loss = self._define_prior_loss()

        if progress_bar:
            myrange = trange
        else:
            myrange = range

        for i in myrange(td["n_iterations"]):
            idx = rand.choice(N, td["batch_size"], replace=False)
            X_batch, Y_batch = X[idx], Y[idx]

            B_ = torch.matmul(U_, V_)

            Y_recon = torch.matmul(X_batch, B_) + A_
            loss_recon = cross_entropy_prod(Y_recon, Y_batch)

            # Prior loss
            loss_reg = prior_loss(U_, V_)

            loss = loss_recon + self.mu * loss_reg

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            self._save_losses(i, loss, loss_recon, loss_reg)

        loss_reg = prior_loss(U_, V_)
        Y_recon = torch.matmul(X, B_) + A_
        loss_recon = loss_function(Y, Y_recon)
        loss = loss_recon + self.mu * loss_reg

        self.optimal_value = loss.detach().numpy()
        self.optimal_loss = loss_recon.detach().numpy()

        self._save_variables(trainable_variables)

        return self

    def unpickle(self, load_name):
        """ 
        Having saved our model parameters using save_model, we can now
        load the parameters into a new object

        Parameters
        ----------
        load_name : str
            The name of the file with saved parameters
        """
        load_dictionary = pickle.load(open(load_name, "rb"))

    def _initialize_trainable_variables(self, X, Y):
        """
        This initializes the trainable variables of the model and returns
        them as a list. Currently initializes U and V randomly from a normal
        distribution, with input data just used to standardize implementation.

        Parameters
        ----------
        X : np.array-like,(n_samples,n_covariates)
            The data

        Y : np.array-like,(n_samples,n_response)
            The response variables

        Returns
        -------
        trainable_variables : list
            List of U and V which are torch.Tensors
        """
        U_ = torch.tensor(rand.randn(self.p, self.L), requires_grad=True)
        V_ = torch.tensor(rand.randn(self.L, self.q), requires_grad=True)
        A_ = torch.tensor(rand.randn(self.q), requires_grad=True)
        trainable_variables = [U_, V_, A_]
        return trainable_variables

    def _define_prior_loss(self):
        """
        This defines a Gaussian prior elementwise on U and V and returns
        the negative log likelihood

        Returns
        -------
        prior_loss : function
            Takes trainable variables and returns loss
        """

        def prior_loss(u, v):
            loss1 = 0.01 * torch.nn.MSE()(u)
            loss2 = 0.01 * torch.nn.MSE()(v)
            return loss1 + loss2

        return prior_loss

    def _save_variables(self, trainable_variables):
        """
        This saves the learned variables as object attributes
        """

        self.U = trainble_variables[0].detach().numpy()
        self.V = trainble_variables[1].detach().numpy()
        self.A = trainble_variables[2].detach().numpy()
        self.B = np.dot(self.U, self.V)


class LogisticReducedNorm(BaseReducedRankRegressionSGD):
    def __init__(self, mu=1.0, training_options={}):
        """
        This fits an explicit low rank model, which is not convex but 
        allows for explicit interpretation of the coefficients in terms 
        of basis vectors.

        Attributes
        ----------
        L : int,default=1
            The rank of the predictive coefficients

        Usage
        -----
        N = 10000
        p,q,R = 30,5,2
        sigma = 1.0
        U = rand.randn(p,R)
        V = rand.randn(R,q)

        B = np.dot(U,V)
        X = rand.randn(N,p)
        Y_hat = np.dot(X,B)
        Y = Y_hat + sigma*rand.randn(N,q)

        """
        self.mu = int(mu)
        super().__init__(training_options=training_options)

    def fit(self, X, Y, progress_bar=True, seed=2021):
        """ 
        Fits a model given covariates X and response Y.

        Parameters
        ----------
        X : np.array-like,(n_samples,n_covariates)
            The data

        Y : np.array-like,(n_samples,n_response)
            The response variables

        progress_bar : bool,default=True
            Whether to print the progress bar to monitor time

        Returns
        -------
        self : object
            The model
        """
        rand.seed(seed)
        td = self.training_options
        N, self.p = X.shape
        _, self.q = Y.shape
        X, Y = self._transform_training_data(X, Y)

        optimizer = return_optimizer_pt(trainable_variables, td)

        trainable_variables = self._initialize_trainable_variables(X, Y)
        B_, A_ = trainable_variables[0], trainable_variables[1]

        self._initialize_losses()

        prior_loss = self._define_prior_loss()

        if progress_bar:
            myrange = trange
        else:
            myrange = range

        for i in myrange(td["n_iterations"]):
            idx = rand.choice(N, td["batch_size"], replace=False)
            X_batch, Y_batch = X[idx], Y[idx]

            Y_recon = torch.matmul(X_batch, B_) + A_
            loss_recon = cross_entropy_prod(Y_recon, Y_batch)

            # Prior loss
            loss_reg = torch.linalg.matrix_norm(B_, ord="nuc")

            loss = loss_recon + self.mu * loss_reg

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            self._save_losses(i, loss, loss_recon, loss_reg)

        loss_reg = torch.linalg.matrix_norm(B_, ord="nuc")
        Y_recon = torch.matmul(X, B_) + A_
        loss_recon = loss_function(Y, Y_recon)
        loss = loss_recon + self.mu * loss_reg

        self.optimal_value = loss.detach().numpy()
        self.optimal_loss = loss_recon.detach().numpy()

        self._save_variables(trainable_variables)

        return self

    def unpickle(self, load_name):
        """ 
        Having saved our model parameters using save_model, we can now
        load the parameters into a new object

        Parameters
        ----------
        load_name : str
            The name of the file with saved parameters
        """
        load_dictionary = pickle.load(open(load_name, "rb"))
        self.B = load_dictionary["model"].B
        self.A = load_dictionary["model"].A

    def _initialize_trainable_variables(self, X, Y):
        """
        This initializes the trainable variables of the model and returns
        them as a list. Currently initializes U and V randomly from a normal
        distribution, with input data just used to standardize implementation.

        Parameters
        ----------
        X : np.array-like,(n_samples,n_covariates)
            The data

        Y : np.array-like,(n_samples,n_response)
            The response variables

        Returns
        -------
        trainable_variables : list
            List of U and V which are torch.Tensors
        """
        B_ = torch.tensor(rand.randn(self.p, self.q), requires_grad=True)
        A_ = torch.tensor(rand.randn(self.q), requires_grad=True)
        trainable_variables = [B_, A_]
        return trainable_variables

    def _save_variables(self, trainable_variables):
        """
        This saves the learned variables as object attributes
        """

        self.B = trainble_variables[0].detach().numpy()
        self.A = trainble_variables[1].detach().numpy()


class LogisticSparseLowRank(BaseReducedRankRegressionSGD):
    def __init__(self, mul=1.0, mus=1.0, training_options={}):
        """
        This fits an explicit low rank model, which is not convex but 
        allows for explicit interpretation of the coefficients in terms 
        of basis vectors.

        Attributes
        ----------
        L : int,default=1
            The rank of the predictive coefficients

        Usage
        -----
        N = 10000
        p,q,R = 30,5,2
        sigma = 1.0
        U = rand.randn(p,R)
        V = rand.randn(R,q)

        B = np.dot(U,V)
        X = rand.randn(N,p)
        Y_hat = np.dot(X,B)
        Y = Y_hat + sigma*rand.randn(N,q)

        """
        self.mul = int(mul)
        self.mus = int(mus)
        super().__init__(training_options=training_options)

    def fit(self, X, Y, progress_bar=True, seed=2021):
        """ 
        Fits a model given covariates X and response Y.

        Parameters
        ----------
        X : np.array-like,(n_samples,n_covariates)
            The data

        Y : np.array-like,(n_samples,n_response)
            The response variables

        progress_bar : bool,default=True
            Whether to print the progress bar to monitor time

        Returns
        -------
        self : object
            The model
        """
        rand.seed(seed)
        td = self.training_options
        N, self.p = X.shape
        _, self.q = Y.shape
        X, Y = self._transform_training_data(X, Y)

        optimizer = return_optimizer_pt(trainable_variables, td)

        trainable_variables = self._initialize_trainable_variables(X, Y)
        L_, S_, A_ = (
            trainable_variables[0],
            trainable_variables[1],
            trainable_variables[2],
        )

        self._initialize_losses()

        prior_loss = self._define_prior_loss()

        if progress_bar:
            myrange = trange
        else:
            myrange = range

        for i in myrange(td["n_iterations"]):
            idx = rand.choice(N, td["batch_size"], replace=False)
            X_batch, Y_batch = X[idx], Y[idx]

            B_ = S_ + L_

            Y_recon = torch.matmul(X_batch, B_) + A_
            loss_recon = cross_entropy_prod(Y_recon, Y_batch)

            # Prior loss
            loss_reg_L = torch.linalg.matrix_norm(L_, ord="nuc")
            loss_reg_S = torch.linalg.vector_norm(torch.flatten(S_), ord=1)

            loss = loss_recon + self.mu * loss_reg

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            self._save_losses(i, loss, loss_recon, loss_reg)

        loss_reg = torch.linalg.matrix_norm(B_, ord="nuc")
        Y_recon = torch.matmul(X, B_) + A_
        loss_recon = loss_function(Y, Y_recon)
        loss = loss_recon + self.mu * loss_reg

        self.optimal_value = loss.detach().numpy()
        self.optimal_loss = loss_recon.detach().numpy()

        self._save_variables(trainable_variables)

        return self

    def unpickle(self, load_name):
        """ 
        Having saved our model parameters using save_model, we can now
        load the parameters into a new object

        Parameters
        ----------
        load_name : str
            The name of the file with saved parameters
        """
        load_dictionary = pickle.load(open(load_name, "rb"))
        self.B = load_dictionary["model"].B
        self.A = load_dictionary["model"].A

    def _initialize_trainable_variables(self, X, Y):
        """
        This initializes the trainable variables of the model and returns
        them as a list. Currently initializes U and V randomly from a normal
        distribution, with input data just used to standardize implementation.

        Parameters
        ----------
        X : np.array-like,(n_samples,n_covariates)
            The data

        Y : np.array-like,(n_samples,n_response)
            The response variables

        Returns
        -------
        trainable_variables : list
            List of S_, L_ and A_ which are torch tensors
        """
        L_ = torch.tensor(rand.randn(self.p, self.q), requires_grad=True)
        S_ = torch.tensor(rand.randn(self.p, self.q), requires_grad=True)
        A_ = torch.tensor(rand.randn(self.q), requires_grad=True)
        trainable_variables = [L_, S_, A_]
        return trainable_variables

    def _save_variables(self, trainable_variables):
        """
        This saves the learned variables as object attributes
        """
        self.L = trainble_variables[0].detach().numpy()
        self.S = trainble_variables[1].detach().numpy()
        self.B = self.L + self.S
        self.A = trainble_variables[2].detach().numpy()

    def _initialize_losses(self):
        """
        This initializes the arrays to store losses

        Attributes
        ----------
        losses : np.array,size=(td['n_iterations'],)
            Total loss including regularization terms

        losses_recon : np.array,size=(td['n_iterations'],)
            Prediction loss

        losses_nuclear : np.array,size=(td['n_iterations'],)
            Regularization on low rank component

        losses_sparse : np.array,size=(td['n_iterations'],)
            Regularization on sparse component
        """
        n_iterations = self.training_options["n_iterations"]
        self.losses = np.zeros(n_iterations)
        self.losses_recon = np.zeros(n_iterations)
        self.losses_sparse = np.zeros(n_iterations)
        self.losses_nuclear = np.zeros(n_iterations)

    def _save_losses(self, i, loss, loss_recon, loss_sparse, loss_nuclear):
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
        self.losses_sparse[i] = loss_sparse.detach().numpy()
        self.losses_nuclear[i] = loss_nuclear.detach().numpy()

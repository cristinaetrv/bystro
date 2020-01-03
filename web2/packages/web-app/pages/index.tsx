import React, { memo } from "react";
import "styles/pages/index.scss";
import DefaultView from '../components/DefaultView/DefaultView';

const index = memo(() => (
  <div id="index" className="centered animated fadeIn">
    <h1 className='animated fadeInUp faster'>
      <a href="https://github.com/akotlar/bystro" target="_blank">
        Bystro
      </a>
    </h1>
    <div className="subheader">Simplified genomics</div>

    <div className="subheader">
      <DefaultView />
    </div>
  </div >
));

export default index;

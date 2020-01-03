// // An upload component
// // Tutorials:
// // https://www.dropzonejs.com/bootstrap.html#
// //
// import React from "react";

// import getConfig from "next/config";

// import PropTypes from "prop-types";
// import { withStyles } from "@material-ui/core/styles";
// import red from "@material-ui/core/colors/red";
// import IconButton from "@material-ui/core/IconButton";
// import Button from "@material-ui/core/Button";

// import List from "@material-ui/core/List";
// import ListItem from "@material-ui/core/ListItem";
// import ListItemText from "@material-ui/core/ListItemText";
// import CircularProgress from "@material-ui/core/CircularProgress";
// import Card from "@material-ui/core/Card";
// import CardActions from "@material-ui/core/CardActions";
// import HighlightOffRounded from "@material-ui/icons/HighlightOffRounded";
// import { view } from "react-easy-state";
// import Grid from "@material-ui/core/Grid";
// import CloudUploadRounded from "@material-ui/icons/CloudUploadRounded";
// import Tooltip from "@material-ui/core/Tooltip";
// import Snackbar from "@material-ui/core/Snackbar";
// import CloseIcon from "@material-ui/icons/Close";
// import DoneAll from "@material-ui/icons/DoneAllRounded";

// import OutlinedInput from "@material-ui/core/OutlinedInput";
// import MenuItem from "@material-ui/core/MenuItem";
// import Select from "@material-ui/core/Select";
// import InputLabel from "@material-ui/core/InputLabel";
// import FormControl from "@material-ui/core/FormControl";


// const { publicRuntimeConfig } = getConfig();

// const url = publicRuntimeConfig.API_UPLOAD_URL;
// const BUCKETS = publicRuntimeConfig.UPLOAD.BUCKETS;

// const isZipExt = {
//     gz: true,
//     bgz: true,
//     zip: true,
//     "7z": true
// };

// const styles = theme => ({
//     root: {
//         display: "flex",
//         justifyContent: "center",
//         alignItems: "flex-end"
//     },
//     listContainer: {
//         minWidth: "66%",
//         maxWidth: "100%",
//         boxShadow: "none"
//     },
//     icon: {
//         margin: theme.spacing.unit * 2
//     },
//     iconHover: {
//         margin: theme.spacing.unit * 2,
//         "&:hover": {
//             color: red[800]
//         }
//     },
//     fileList: {
//         maxHeight: "70vh",
//         overflowY: "scroll"
//     },
//     cardActions: {
//         alignItems: "end"
//     },
//     fileItem: {
//         width: "100%",
//         wordBreak: "break-word"
//     },
//     formControl: {
//         minWidth: 250
//     },
//     selectEmpty: {
//         marginTop: theme.spacing.unit * 2
//     }
// });

// const dropzoneOptions = {
//     url, // Set the url
//     paramName: "file", // The name that will be used to transfer the file
//     maxFilesize: null,
//     thumbnailWidth: 80,
//     thumbnailHeight: 80,
//     parallelUploads: 20,
//     autoProcessQueue: false,
//     previewsContainer: false,
//     addRemoveLinks: false,
//     timeout: 1000 * 60 * 60 * 60 // 60 hours in milliseconds
// };

// const snackbarAutohideDuration = 1000;

// let Dropzone;
// let dropzoneInstance;

// class SimpleSnackbar extends React.Component {
//     state = {
//         open: false
//     };

//     componentDidMount = () => {
//         this.handleClick();
//     };

//     handleClick = () => {
//         this.setState({ open: true });
//     };

//     handleClose = (event, reason) => {
//         if (reason === "clickaway") {
//             return;
//         }

//         this.setState({ open: false });
//     };

//     render() {
//         const { classes } = this.props;

//         return (
//             <div>
//                 <Snackbar
//                     anchorOrigin={{
//                         vertical: "bottom",
//                         horizontal: "center"
//                     }}
//                     open={this.state.open}
//                     autoHideDuration={snackbarAutohideDuration - 250}
//                     onClose={this.handleClose}
//                     ContentProps={{
//                         "aria-describedby": "message-id"
//                     }}
//                     message={<span id="message-id">All Files Uploaded!</span>}
//                     action={[
//                         <IconButton
//                             key="close"
//                             aria-label="Close"
//                             color="inherit"
//                             className={classes.close}
//                             onClick={this.handleClose}
//                         >
//                             <CloseIcon />
//                         </IconButton>
//                     ]}
//                 />
//             </div>
//         );
//     }
// }

// SimpleSnackbar.propTypes = {
//     classes: PropTypes.object.isRequired
// };

// const getExtension = filename => {
//     const parts = filename.split(".");

//     if (parts == 2) {
//         return parts[1];
//     }

//     const last = parts[parts.length - 1];

//     if (isZipExt[last]) {
//         return parts[parts.length - 2];
//     }

//     return last;
// };

// const getBucket = fileExtension => {
//     if (fileExtension.match(/vcf/gi)) {
//         return BUCKETS.DATA;
//     }

//     if (fileExtension.match(/(pheno)|(alexdb)|(fam)/gi) !== null) {
//         return BUCKETS.PHENO;
//     }

//     return null;
// };

// class Uploader extends React.Component {
//     /**
//      * React 'componentDidMount' method
//      * Sets up dropzone.js with the component.
//      */
//     /**************************** Lifetime methods ******************************/
//     constructor(props) {
//         super(props);

//         this.state = {
//             files: this.dropzone ? this.dropzone.getActiveFiles() : [],
//             fileIdx: {},
//             success: false,
//             u: false,
//             showCancel: {}
//         };
//     }

//     /**
//      * React 'componentDidMount' : guaranteed to occur on client
//      * Dropzone needs window, which is available after component mounts or updates
//      **/
//     componentDidMount = () => {
//         this.dropzoneSingleton();
//     };

//     /**
//      * React 'componentDidUpdate'
//      * If the Dropzone hasn't been created, create it
//      * Dropzone needs window, which is available after component mounts or updates
//      **/
//     componentDidUpdate = () => {
//         this.queueDestroy = false;

//         this.dropzoneSingleton();
//     };

//     /**
//      * React 'componentWillUnmount'
//      * Removes dropzone.js (and all its globals) if the component is being unmounted
//      */
//     componentWillUnmount() {
//         if (this.dropzone) {
//             const files = this.dropzone.getActiveFiles();

//             if (files.length > 0) {
//                 this.queueDestroy = true;

//                 const destroyInterval = window.setInterval(() => {
//                     if (this.queueDestroy === false) {
//                         return window.clearInterval(destroyInterval);
//                     }

//                     if (this.dropzone.getActiveFiles().length === 0) {
//                         this.dropzone = this.destroy(this.dropzone);
//                         return window.clearInterval(destroyInterval);
//                     }
//                 }, 500);
//             } else {
//                 this.dropzone = this.destroy(this.dropzone);
//             }
//         }
//     }

//     /**
//      * Removes ALL listeners and Destroys dropzone. see https://github.com/enyo/dropzone/issues/1175
//      */
//     destroy() {
//         this.dropzone.off();
//         this.dropzone.destroy();
//         dropzoneInstance = null;

//         return null;
//     }

//     dropzoneSingleton = () => {
//         if (!dropzoneInstance) {
//             Dropzone = Dropzone || require("dropzone");
//             Dropzone.autoDiscover = false;

//             const updateOptions = this.dropzoneSetup(dropzoneOptions);

//             dropzoneInstance = new Dropzone(document.body, updateOptions);

//             this.dropzone = dropzoneInstance;

//             this.setupEvents();
//         }

//         this.queueDestroy = false;
//         return this.dropzone;
//     };

//     /***************************** Data methods *********************************/
//     dropzoneSetup = dropzoneOptions => {
//         const opts = Object.assign({}, dropzoneOptions);

//         opts.clickable = ".dz-clickable";

//         // It seems order of instantiation isn't from _app down?
//         // This is called in _app, on componentDidMount,
//         Auth.initialize();

//         opts.headers = { Authorization: `Bearer ${Auth.state.idToken}` };

//         return opts;
//     };

//     setupEvents() {
//         this.dropzone.on("addedfile", file => {
//             if (!file) return;

//             const files = this.state.files || [];
//             const fileExtension = getExtension(file.name);
//             const bucket = getBucket(fileExtension);

//             file.fileExtension = fileExtension;
//             file.bucket = bucket;

//             files.push(file);
//             this.setState({ files });
//         });

//         let timeout;
//         this.dropzone.on("uploadprogress", (file, progress) => {
//             if (timeout) {
//                 clearTimeout(timeout);
//             }

//             timeout = setTimeout(() => {
//                 this.forceUpdate();
//             }, 33);
//         });

//         this.dropzone.on("sending", function (file, xhr, formData) {
//             // Will send the filesize along with the file as POST data.
//             formData.append("bucket", file.bucket);

//             console.info("formData", formData, file);
//         });

//         this.dropzone.on("removedfile", file => {
//             if (!file) return;

//             if (!this.state.files) {
//                 return;
//             }

//             const files = this.state.files.filter(eFile => {
//                 return eFile.upload.uuid !== file.upload.uuid;
//             });

//             this.setState({ files });
//         });

//         this.dropzone.on("queuecomplete", progress => {
//             // if (progress === 100) {
//             this.dropzone.removeAllFiles(true);
//             this.setState({ files: [], uploading: false, success: true });

//             // A duration slighlty higher than autohide
//             setTimeout(() => {
//                 this.setState({ success: false });
//                 this.forceUpdate();
//             }, snackbarAutohideDuration + 50);
//         });
//     }

//     deleteFileFromList = (file, index) => {
//         this.dropzone.removeFile(file);
//         this.state.files.splice(index, 1);
//         this.setState({ files: this.state.files });
//     };

//     handleUploadStart = () => {
//         this.dropzone.processQueue();
//         this.setState({ uploading: true });
//     };

//     handleUpdateBucket = (i, e) => {
//         this.setState(prevState => {
//             const files = prevState.files.slice(0);

//             files[i].bucket = e.target.value;

//             return { files };
//         });
//     };

//     showOrHide = index => {
//         this.setState(state => {
//             const showCancel = state.showCancel || {};

//             showCancel[index] = !showCancel[index];

//             return {
//                 showCancel: showCancel
//             };
//         });
//     };

//     render() {
//         const { classes } = this.props;

//         return (
//             <React.Fragment>
//                 {/* {this.state.files.length == 0 && ( */}
//                 {/* Can't remove from DOM, because dropzone won't know to re-initialize */}
//                 <Tooltip
//                     title="Upload (Click or Drop)"
//                     style={{
//                         display:
//                             this.state.files.length == 0 && !this.state.success
//                                 ? "inline"
//                                 : "none"
//                     }}
//                 >
//                     <IconButton
//                         style={{
//                             display:
//                                 this.state.files.length == 0 && !this.state.success
//                                     ? "inherit"
//                                     : "none"
//                         }}
//                         className={`${classes.button} dz-clickable`}
//                         aria-label="Upload"
//                     >
//                         <CloudUploadRounded style={{ fontSize: 48 }} />
//                         {/* <GetAppIcon /> */}
//                     </IconButton>
//                 </Tooltip>
//                 <DoneAll
//                     style={{
//                         display: this.state.success ? "inline" : "none",
//                         fontSize: 48
//                     }}
//                 />
//                 {this.state.success ? <SimpleSnackbar classes={classes} /> : ""}
//                 <Card className={classes.listContainer}>
//                     <List className={classes.fileList} id="previews">
//                         <style jsx>{`
//               .hover-button .hover-button--on,
//               .hover-button:hover .hover-button--off {
//                 display: none;
//               }

//               .hover-button:hover .hover-button--on {
//                 display: inline;
//               }
//             `}</style>
//                         {this.state.files.map((file, index) => (
//                             <ListItem
//                                 key={file.upload.uuid}
//                                 style={{
//                                     display: "flex",
//                                     alignItems: "center",
//                                     justifyContent: "space-between"
//                                 }}
//                             >
//                                 <ListItemText
//                                     primary={file.name}
//                                     secondary={`${
//                                         file.size
//                                         } bytes (${file.upload.progress.toFixed(2)}\% uploaded)`}
//                                     className={classes.fileItem}
//                                 />
//                                 <FormControl variant="outlined" className={classes.formControl}>
//                                     <InputLabel htmlFor="bucket-select">S3 Bucket</InputLabel>
//                                     <Select
//                                         value={file.bucket || ""}
//                                         onChange={e => this.handleUpdateBucket(index, e)}
//                                         input={<OutlinedInput labelWidth={80} id="bucket-select" />}
//                                         disabled={file.status === "uploading"}
//                                     >
//                                         <MenuItem value="">
//                                             <em>None</em>
//                                         </MenuItem>
//                                         {Object.keys(BUCKETS).map(k => (
//                                             <MenuItem key={k} value={BUCKETS[k]}>
//                                                 {BUCKETS[k]}
//                                             </MenuItem>
//                                         ))}
//                                     </Select>
//                                 </FormControl>
//                                 <React.Fragment>
//                                     {file.status === "uploading" || file.status === "success" ? (
//                                         file.upload.progress < 100 ? (
//                                             <IconButton
//                                                 onClick={() => this.dropzone.removeFile(file)}
//                                                 style={{ marginLeft: 14 }}
//                                             >
//                                                 <HighlightOffRounded />
//                                                 <CircularProgress
//                                                     variant={
//                                                         file.upload.progress > 5
//                                                             ? "determinate"
//                                                             : "indeterminate"
//                                                     }
//                                                     value={file.upload.progress}
//                                                     style={{ position: "absolute" }}
//                                                 />
//                                             </IconButton>
//                                         ) : (
//                                                 <div>Done</div>
//                                             )
//                                     ) : (
//                                             <IconButton
//                                                 onClick={() => this.dropzone.removeFile(file)}
//                                                 style={{ marginLeft: 14 }}
//                                             >
//                                                 <HighlightOffRounded />
//                                             </IconButton>
//                                         )}
//                                     {/* <Button onClick={() => this.dropzone.processFile(file)}>
//                     Start
//                   </Button> */}
//                                 </React.Fragment>
//                             </ListItem>
//                         ))}
//                     </List>
//                     {this.state.files.length && !this.state.uploading ? (
//                         <CardActions className={classes.cardActions}>
//                             <Grid
//                                 container
//                                 alignItems="center"
//                                 direction="column"
//                                 justify="center"
//                             >
//                                 <Grid item>
//                                     <Button onClick={this.handleUploadStart}>Start</Button>
//                                 </Grid>
//                             </Grid>
//                         </CardActions>
//                     ) : (
//                             ""
//                         )}
//                 </Card>
//             </React.Fragment>
//         );
//     }
// }

// export default withStyles(styles)(view(Uploader));

export default () => <div>Hello</div>
import { PureComponent, Fragment } from "react";

type Props = {
  input: {
    value: assemblyValue;
  };
  onSelected: (res: any) => void;
  // inputStage: number
};

type assemblies = { [assembly: string]: { aliases: string[] } }[];

type assemblyValue = {
  assembly: string;
  specie: string;
  aliases: string[];
};

type state = {
  idx: number;
  chosenSpecie?: string;
  chosenAssembly?: string;
  assemblySpec: any;
  selectedAssembly?: assemblyValue;
  selectedSpecie: { specie: string; assemblies: assemblies };
  assemblies: assemblies;
  species: { specie: string; assemblies: assemblies }[];
  cb: (res: assemblyValue) => void;
};
class GenomeSelector extends PureComponent<Props> {
  state: state = {
    assemblySpec: null,
    selectedSpecie: null,
    idx: 0,
    species: [],
    assemblies: [],
    cb: null
    // inputStage: null,
  };

  constructor(props: any) {
    super(props);

    const assemblyInput = props.input;
    const schema = assemblyInput.spec.schema;

    this.state.species = schema;
    this.state.cb = props.onSelected;
    this.state.idx = 0;

    const assembly = assemblyInput.value;
    if (assembly !== null && assembly !== undefined) {
      this.state.selectedAssembly = assembly;

      this.state.selectedSpecie = this.state.species.find(
        entry => entry.specie === this.state.selectedAssembly.specie
      );

      console.info(this.state.selectedSpecie);
      return;
    }

    this.state.selectedSpecie = schema[0];
    this.state.selectedAssembly = null;
    console.info("selected", this.state.selectedSpecie);
  }

  handleSelected = (e: any) => {
    const assembly = e.target.value;

    this.state.cb(assembly);
  };

  handleSpeciesChosen = (e: any) => {
    const idx = e.target.value;

    this.setState({
      assemblies: this.state.species[idx].assemblies
    });
  };

  render() {
    return (
      <Fragment>
        <h3>Choose a genome</h3>
        <span
          className="content"
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexDirection: "row",
            marginLeft: 0
          }}
        >
          <select
            defaultValue={this.state.selectedSpecie.specie}
            onChange={this.handleSpeciesChosen}
          >
            {this.state.species.map((entry, idx) => (
              <option key={idx} value={idx}>
                {entry.specie}
              </option>
            ))}
          </select>
          <select
            defaultValue={
              (this.state.selectedAssembly &&
                this.state.selectedAssembly.assembly) ||
              ""
            }
            onChange={this.handleSelected}
          >
            <option disabled value="">
              Assembly
            </option>
            {Object.keys(this.state.selectedSpecie.assemblies).map(
              (assembly, idx) => (
                <option key={idx} value={assembly}>
                  {assembly}
                </option>
              )
            )}
          </select>
        </span>
      </Fragment>
    );
  }
}
export default GenomeSelector;
